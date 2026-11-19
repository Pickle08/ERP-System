<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckIntegrity extends Command
{
    protected $signature = 'erp:check-integrity';

    protected $description = 'Cek konsistensi data: saldo stok vs ledger, pembayaran vs invoice';

    public function handle(): int
    {
        $stockMismatch = DB::select(<<<'SQL'
            SELECT b.product_id, b.warehouse_id, b.quantity AS balance, COALESCE(m.total, 0) AS ledger
              FROM stock_balances b
         LEFT JOIN (SELECT product_id, warehouse_id, SUM(quantity) AS total
                      FROM stock_movements
                     GROUP BY product_id, warehouse_id) m
                ON m.product_id = b.product_id AND m.warehouse_id = b.warehouse_id
             WHERE b.quantity <> COALESCE(m.total, 0)
        SQL);

        $paymentMismatch = DB::select(<<<'SQL'
            SELECT i.id, i.invoice_number, i.paid_amount, COALESCE(p.total, 0) AS payments_total
              FROM invoices i
         LEFT JOIN (SELECT invoice_id, SUM(amount) AS total
                      FROM payments
                     WHERE status = 'active'
                     GROUP BY invoice_id) p
                ON p.invoice_id = i.id
             WHERE i.paid_amount <> COALESCE(p.total, 0)
        SQL);

        $this->report('Saldo stok vs ledger', $stockMismatch, ['product_id', 'warehouse_id', 'balance', 'ledger']);
        $this->report('Pembayaran vs invoice', $paymentMismatch, ['id', 'invoice_number', 'paid_amount', 'payments_total']);

        return ($stockMismatch || $paymentMismatch) ? self::FAILURE : self::SUCCESS;
    }

    private function report(string $title, array $rows, array $columns): void
    {
        if ($rows === []) {
            $this->info("[OK]    {$title}");

            return;
        }

        $this->error("[GAGAL] {$title}: " . count($rows) . ' baris tidak cocok');
        $this->table($columns, array_map(fn($r) => array_values((array) $r), $rows));
    }
}
