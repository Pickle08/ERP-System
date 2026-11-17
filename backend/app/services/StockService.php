<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use LogicException;
use InvalidArgumentException;

class StockService
{
    /**
     * Catat satu pergerakan stok sekaligus update saldo.
     *
     * WAJIB dipanggil di dalam DB::transaction() milik pemanggil, supaya
     * dokumen asal (PO/SO) dan perubahan stok commit atau rollback bareng.
     *
     * @param string $delta Selisih bertanda: "10" = masuk, "-4" = keluar. Tidak boleh nol.
     */
    public function record(
        int $productId,
        int $warehouseId,
        StockMovementType $type,
        string $delta,
        string $reason,
        int $userId,
        ?string $referenceNumber = null,
        ?string $notes = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
    ): StockMovement {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('StockService::record() harus dipanggil di dalam DB transaction.');
        }

        // 1. Pastikan baris saldo ada. Aman untuk request paralel karena ada unique index.
        DB::table('stock_balances')->insertOrIgnore([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'quantity' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Update atomik. Syarat "saldo tidak boleh negatif" dicek di dalam SQL-nya,
        //    jadi dua request barengan tidak bisa sama-sama lolos.
        $affected = DB::update(
            'UPDATE stock_balances
                SET quantity = quantity + CAST(? AS DECIMAL(15,3)), updated_at = ?
              WHERE product_id = ? AND warehouse_id = ?
                AND quantity + CAST(? AS DECIMAL(15,3)) >= 0',
            [$delta, now(), $productId, $warehouseId, $delta]
        );

        if ($affected === 0) {
            $rowExists = DB::table('stock_balances')
                ->where('product_id', $productId)
                ->where('warehouse_id', $warehouseId)
                ->exists();

            // Baris saldo tidak ada = insertOrIgnore ditolak FK (produk/gudang tidak valid),
            // bukan karena stok kurang.
            if (!$rowExists) {
                throw new InvalidArgumentException("Produk #{$productId} atau gudang #{$warehouseId} tidak valid.");
            }

            $name = Product::withTrashed()->whereKey($productId)->value('name') ?? "#{$productId}";
            throw new InsufficientStockException($name);
        }

        // 3. Baca saldo terbaru. Baris ini sudah dikunci oleh UPDATE sampai transaksi selesai.
        $balanceAfter = DB::table('stock_balances')
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->lockForUpdate()
            ->value('quantity');

        // 4. Tulis ledger.
        return StockMovement::create([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'type' => $type,
            'quantity' => $delta,
            'balance_after' => $balanceAfter,
            'reason' => $reason,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'reference_number' => $referenceNumber,
            'notes' => $notes,
            'created_by' => $userId,
        ]);
    }
}
