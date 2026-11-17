<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\SalesOrderStatus;
use App\Enums\StockMovementType;
use App\Models\Invoice;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalesOrderService
{
    public function __construct(
        private readonly DocumentNumberService $numbers,
        private readonly StockService $stock,
    ) {
    }

    public function create(array $data, User $user): SalesOrder
    {
        return DB::transaction(function () use ($data, $user) {
            $so = SalesOrder::create([
                'so_number' => $this->numbers->next('SO'),
                'customer_id' => $data['customer_id'],
                'warehouse_id' => $data['warehouse_id'],
                'order_date' => $data['order_date'],
                'payment_terms_days' => $data['payment_terms_days'] ?? 0,
                'status' => SalesOrderStatus::Draft,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            $this->syncItems($so, $data['items']);
            $this->recordHistory($so, null, SalesOrderStatus::Draft, $user->id, 'SO dibuat');

            return $so;
        });
    }

    public function update(SalesOrder $so, array $data): SalesOrder
    {
        return DB::transaction(function () use ($so, $data) {
            $locked = SalesOrder::whereKey($so->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== SalesOrderStatus::Draft) {
                abort(409, 'SO hanya bisa diubah saat berstatus draft.');
            }

            $locked->update([
                'customer_id' => $data['customer_id'],
                'warehouse_id' => $data['warehouse_id'],
                'order_date' => $data['order_date'],
                'payment_terms_days' => $data['payment_terms_days'] ?? 0,
                'tax_amount' => $data['tax_amount'] ?? 0,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncItems($locked, $data['items']);

            return $locked;
        });
    }

    /**
     * Konfirmasi: cek ketersediaan stok, TAPI tidak mereservasi dan tidak mengurangi stok.
     */
    public function confirm(SalesOrder $so, User $user, ?string $note = null): SalesOrder
    {
        return DB::transaction(fn() => $this->lockAndTransition(
            $so->id,
            SalesOrderStatus::Confirmed,
            $user,
            $note,
            ['confirmed_by' => $user->id, 'confirmed_at' => now()],
            fn(SalesOrder $locked) => $this->assertStockAvailable($locked),
        ));
    }

    /**
     * Barang keluar: status + pengurangan stok + invoice dalam SATU transaksi.
     * Satu item kurang stok = semuanya rollback (all-or-nothing).
     */
    public function issue(SalesOrder $so, User $user, ?string $note = null): SalesOrder
    {
        return DB::transaction(function () use ($so, $user, $note) {
            $locked = $this->lockAndTransition(
                $so->id,
                SalesOrderStatus::Issued,
                $user,
                $note,
                ['issued_by' => $user->id, 'issued_at' => now()],
            );

            // Urut product_id supaya dua SO barengan tidak saling deadlock.
            foreach ($locked->items()->orderBy('product_id')->get() as $item) {
                $this->stock->record(
                    productId: $item->product_id,
                    warehouseId: $locked->warehouse_id,
                    type: StockMovementType::SalesIssue,
                    delta: '-' . $item->quantity,
                    reason: "Pengeluaran barang {$locked->so_number}",
                    userId: $user->id,
                    referenceNumber: $locked->so_number,
                    referenceType: 'sales_order',
                    referenceId: $locked->id,
                );
            }

            // Baca ulang: subtotal/total dihitung database.
            $locked->refresh();
            $invoiceDate = now();

            Invoice::create([
                'invoice_number' => $this->numbers->next('INV'),
                'sales_order_id' => $locked->id,
                'customer_id' => $locked->customer_id,
                'invoice_date' => $invoiceDate->toDateString(),
                'due_date' => $invoiceDate->copy()->addDays($locked->payment_terms_days)->toDateString(),
                'subtotal' => $locked->subtotal,
                'tax_amount' => $locked->tax_amount,
                'total' => $locked->total,
                'paid_amount' => 0,
                'payment_status' => PaymentStatus::Unpaid,
                'status' => InvoiceStatus::Active,
                'created_by' => $user->id,
            ]);

            return $locked;
        });
    }

    /**
     * Batal. Aturan pembalikan stok:
     *  - dari draft/confirmed : tidak ada efek ke stok
     *  - dari issued          : stok dikembalikan, invoice di-void.
     *                           Hanya admin, dan ditolak kalau invoice sudah ada pembayaran.
     */
    public function cancel(SalesOrder $so, User $user, string $note): SalesOrder
    {
        return DB::transaction(function () use ($so, $user, $note) {
            $current = SalesOrder::whereKey($so->id)->lockForUpdate()->firstOrFail();
            $wasIssued = $current->status === SalesOrderStatus::Issued;

            if ($wasIssued) {
                if (!$user->hasRole('admin')) {
                    abort(403, 'Hanya admin yang boleh membatalkan SO yang barangnya sudah keluar.');
                }

                $hasPayment = Invoice::where('sales_order_id', $current->id)
                    ->where('paid_amount', '>', 0)
                    ->exists();

                if ($hasPayment) {
                    abort(409, 'Invoice sudah memiliki pembayaran, SO tidak bisa dibatalkan.');
                }
            }

            $locked = $this->lockAndTransition($current->id, SalesOrderStatus::Cancelled, $user, $note);

            if ($wasIssued) {
                foreach ($locked->items()->orderBy('product_id')->get() as $item) {
                    $this->stock->record(
                        productId: $item->product_id,
                        warehouseId: $locked->warehouse_id,
                        type: StockMovementType::SalesCancel,
                        delta: (string) $item->quantity,
                        reason: Str::limit("Pembatalan {$locked->so_number}: {$note}", 255, ''),
                        userId: $user->id,
                        referenceNumber: $locked->so_number,
                        referenceType: 'sales_order',
                        referenceId: $locked->id,
                    );
                }

                Invoice::where('sales_order_id', $locked->id)->update([
                    'status' => InvoiceStatus::Void->value,
                    'voided_at' => now(),
                ]);
            }

            return $locked;
        });
    }

    private function lockAndTransition(
        int $soId,
        SalesOrderStatus $to,
        User $user,
        ?string $note,
        array $attributes = [],
        ?callable $guard = null,
    ): SalesOrder {
        $locked = SalesOrder::whereKey($soId)->lockForUpdate()->firstOrFail();
        $from = $locked->status;

        if (!$from->canTransitionTo($to)) {
            abort(409, "SO berstatus {$from->value}, tidak bisa diubah menjadi {$to->value}.");
        }

        if ($guard) {
            $guard($locked);
        }

        $locked->update(array_merge(['status' => $to], $attributes));
        $this->recordHistory($locked, $from, $to, $user->id, $note);

        return $locked;
    }

    private function assertStockAvailable(SalesOrder $so): void
    {
        // Perbandingan desimal dilakukan di SQL, bukan float di PHP.
        $shortages = DB::table('sales_order_items as i')
            ->join('products as p', 'p.id', '=', 'i.product_id')
            ->leftJoin('stock_balances as b', function ($join) use ($so) {
                $join->on('b.product_id', '=', 'i.product_id')
                    ->where('b.warehouse_id', '=', $so->warehouse_id);
            })
            ->where('i.sales_order_id', $so->id)
            ->whereRaw('COALESCE(b.quantity, 0) < i.quantity')
            ->select('p.name', 'i.quantity as needed', DB::raw('COALESCE(b.quantity, 0) as available'))
            ->get();

        if ($shortages->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => $shortages->map(
                    fn($r) => "Stok {$r->name} tidak cukup (butuh {$r->needed}, tersedia {$r->available})."
                )->all(),
            ]);
        }
    }

    private function syncItems(SalesOrder $so, array $items): void
    {
        $so->items()->delete();

        foreach ($items as $item) {
            $so->items()->create([
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'discount_percent' => $item['discount_percent'] ?? 0,
            ]);
        }

        // line_total & total = generated column. Subtotal dijumlahkan database.
        DB::update(
            'UPDATE sales_orders
                SET subtotal = (SELECT COALESCE(SUM(line_total), 0)
                                  FROM sales_order_items
                                 WHERE sales_order_id = ?)
              WHERE id = ?',
            [$so->id, $so->id]
        );
    }

    private function recordHistory(
        SalesOrder $so,
        ?SalesOrderStatus $from,
        SalesOrderStatus $to,
        int $userId,
        ?string $note,
    ): void {
        $so->statusHistories()->create([
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $userId,
            'note' => $note,
        ]);
    }
}
