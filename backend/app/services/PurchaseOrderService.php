<?php

namespace App\Services;

use App\Enums\PurchaseOrderStatus;
use App\Enums\StockMovementType;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    public function __construct(
        private readonly DocumentNumberService $numbers,
        private readonly StockService $stock,
    ) {
    }

    public function create(array $data, User $user): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $user) {
            $po = PurchaseOrder::create([
                'po_number' => $this->numbers->next('PO'),
                'supplier_id' => $data['supplier_id'],
                'warehouse_id' => $data['warehouse_id'],
                'order_date' => $data['order_date'],
                'expected_date' => $data['expected_date'] ?? null,
                'status' => PurchaseOrderStatus::Draft,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            $this->syncItems($po, $data['items']);
            $this->recordHistory($po, null, PurchaseOrderStatus::Draft, $user->id, 'PO dibuat');

            return $po;
        });
    }

    public function update(PurchaseOrder $po, array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $data) {
            $locked = PurchaseOrder::whereKey($po->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== PurchaseOrderStatus::Draft) {
                abort(409, 'PO hanya bisa diubah saat berstatus draft.');
            }

            $locked->update([
                'supplier_id' => $data['supplier_id'],
                'warehouse_id' => $data['warehouse_id'],
                'order_date' => $data['order_date'],
                'expected_date' => $data['expected_date'] ?? null,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncItems($locked, $data['items']);

            return $locked;
        });
    }

    public function approve(PurchaseOrder $po, User $user, ?string $note = null): PurchaseOrder
    {
        return DB::transaction(fn() => $this->lockAndTransition(
            $po->id,
            PurchaseOrderStatus::Approved,
            $user,
            $note,
            ['approved_by' => $user->id, 'approved_at' => now()],
        ));
    }

    public function cancel(PurchaseOrder $po, User $user, string $note): PurchaseOrder
    {
        return DB::transaction(fn() => $this->lockAndTransition(
            $po->id,
            PurchaseOrderStatus::Cancelled,
            $user,
            $note,
        ));
    }

    /**
     * Terima barang: ubah status + tambah stok dalam SATU transaksi.
     * Gagal di mana pun = semuanya rollback.
     */
    public function receive(PurchaseOrder $po, User $user, ?string $note = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $user, $note) {
            // Baris PO dikunci: klik "Terima" dua kali tidak bisa menggandakan stok.
            // Request kedua menunggu, lalu melihat status sudah received dan ditolak 409.
            $locked = $this->lockAndTransition(
                $po->id,
                PurchaseOrderStatus::Received,
                $user,
                $note,
                ['received_by' => $user->id, 'received_at' => now()],
            );

            // Urut product_id: PO berbeda yang barengan mengunci baris stok
            // dengan urutan sama, jadi tidak saling deadlock.
            $items = $locked->items()->orderBy('product_id')->get();

            foreach ($items as $item) {
                $this->stock->record(
                    productId: $item->product_id,
                    warehouseId: $locked->warehouse_id,
                    type: StockMovementType::PurchaseReceipt,
                    delta: $item->quantity,
                    reason: "Penerimaan barang {$locked->po_number}",
                    userId: $user->id,
                    referenceNumber: $locked->po_number,
                    referenceType: 'purchase_order',
                    referenceId: $locked->id,
                );
            }

            return $locked;
        });
    }

    private function lockAndTransition(
        int $poId,
        PurchaseOrderStatus $to,
        User $user,
        ?string $note,
        array $attributes = [],
    ): PurchaseOrder {
        $locked = PurchaseOrder::whereKey($poId)->lockForUpdate()->firstOrFail();
        $from = $locked->status;

        if (!$from->canTransitionTo($to)) {
            abort(409, "PO berstatus {$from->value}, tidak bisa diubah menjadi {$to->value}.");
        }

        $locked->update(array_merge(['status' => $to], $attributes));
        $this->recordHistory($locked, $from, $to, $user->id, $note);

        return $locked;
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        $po->items()->delete();

        foreach ($items as $item) {
            $po->items()->create([
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
            ]);
        }

        // line_total dihitung generated column; subtotal dijumlahkan database.
        // total = subtotal + tax_amount juga generated. Tidak ada aritmetika uang di PHP.
        DB::update(
            'UPDATE purchase_orders
                SET subtotal = (SELECT COALESCE(SUM(line_total), 0)
                                  FROM purchase_order_items
                                 WHERE purchase_order_id = ?)
              WHERE id = ?',
            [$po->id, $po->id]
        );
    }

    private function recordHistory(
        PurchaseOrder $po,
        ?PurchaseOrderStatus $from,
        PurchaseOrderStatus $to,
        int $userId,
        ?string $note,
    ): void {
        $po->statusHistories()->create([
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $userId,
            'note' => $note,
        ]);
    }
}
