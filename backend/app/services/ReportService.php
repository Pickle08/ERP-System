<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\RecordStatus;
use App\Enums\PurchaseOrderStatus;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Ringkasan: penjualan, pembelian, piutang (snapshot hari ini), biaya, pembayaran masuk.
     */
    public function summary(string $from, string $to): array
    {
        $today = now()->toDateString();

        $sales = DB::table('invoices')
            ->where('status', InvoiceStatus::Active->value)
            ->whereBetween('invoice_date', [$from, $to])
            ->selectRaw(
                'COUNT(*) as invoice_count, '
                . $this->sum('subtotal') . ' as subtotal, '
                . $this->sum('tax_amount') . ' as tax_amount, '
                . $this->sum('total') . ' as total'
            )->first();

        $purchases = DB::table('purchase_orders')
            ->where('status', PurchaseOrderStatus::Received->value)
            ->whereBetween('order_date', [$from, $to])
            ->selectRaw(
                'COUNT(*) as order_count, '
                . $this->sum('subtotal') . ' as subtotal, '
                . $this->sum('tax_amount') . ' as tax_amount, '
                . $this->sum('total') . ' as total'
            )->first();

        $receivables = DB::table('invoices')
            ->where('status', InvoiceStatus::Active->value)
            ->where('outstanding_amount', '>', 0)
            ->selectRaw(
                'COUNT(*) as invoice_count, '
                . $this->sum('outstanding_amount') . ' as outstanding, '
                . 'ROUND(COALESCE(SUM(CASE WHEN COALESCE(due_date, invoice_date) < ? '
                . 'THEN outstanding_amount ELSE 0 END), 0), 2) as overdue',
                [$today]
            )->first();

        $expenses = DB::table('expenses')
            ->where('status', RecordStatus::Active->value)
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('COUNT(*) as expense_count, ' . $this->sum('amount') . ' as total')
            ->first();

        $payments = DB::table('payments')
            ->where('status', RecordStatus::Active->value)
            ->whereBetween('payment_date', [$from, $to])
            ->selectRaw('COUNT(*) as payment_count, ' . $this->sum('amount') . ' as total')
            ->first();

        return [
            'period' => ['from' => $from, 'to' => $to],
            'sales' => (array) $sales,
            'purchases' => (array) $purchases,
            'receivables' => ['as_of' => $today] + (array) $receivables,
            'expenses' => (array) $expenses,
            'payments_received' => (array) $payments,
        ];
    }

    /**
     * Laporan penjualan per hari / bulan / customer.
     */
    public function sales(string $from, string $to, string $groupBy, ?string $paymentStatus, ?int $customerId): array
    {
        $base = fn() => DB::table('invoices')
            ->where('invoices.status', InvoiceStatus::Active->value)
            ->whereBetween('invoices.invoice_date', [$from, $to])
            ->when($paymentStatus, fn($q, $v) => $q->where('invoices.payment_status', $v))
            ->when($customerId, fn($q, $v) => $q->where('invoices.customer_id', $v));

        $metrics = 'COUNT(*) as invoice_count, '
            . $this->sum('invoices.subtotal') . ' as subtotal, '
            . $this->sum('invoices.tax_amount') . ' as tax_amount, '
            . $this->sum('invoices.total') . ' as total';

        $rows = $base();

        if ($groupBy === 'customer') {
            $rows->join('customers', 'customers.id', '=', 'invoices.customer_id')
                ->selectRaw('customers.name as label')
                ->groupBy('customers.id', 'customers.name')
                ->orderBy('customers.name');
        } else {
            $label = $groupBy === 'month'
                ? "DATE_FORMAT(invoices.invoice_date, '%Y-%m')"
                : 'invoices.invoice_date';

            $rows->selectRaw("{$label} as label")->groupByRaw($label)->orderByRaw($label);
        }

        return [
            'rows' => $rows->selectRaw($metrics)->get(),
            'totals' => $base()->selectRaw($metrics)->first(),
        ];
    }

    /**
     * Laporan pembelian per hari / bulan / supplier, difilter status PO.
     */
    public function purchases(string $from, string $to, string $groupBy, string $status, ?int $supplierId): array
    {
        $base = fn() => DB::table('purchase_orders')
            ->where('purchase_orders.status', $status)
            ->whereBetween('purchase_orders.order_date', [$from, $to])
            ->when($supplierId, fn($q, $v) => $q->where('purchase_orders.supplier_id', $v));

        $metrics = 'COUNT(*) as order_count, '
            . $this->sum('purchase_orders.subtotal') . ' as subtotal, '
            . $this->sum('purchase_orders.tax_amount') . ' as tax_amount, '
            . $this->sum('purchase_orders.total') . ' as total';

        $rows = $base();

        if ($groupBy === 'supplier') {
            $rows->join('suppliers', 'suppliers.id', '=', 'purchase_orders.supplier_id')
                ->selectRaw('suppliers.name as label')
                ->groupBy('suppliers.id', 'suppliers.name')
                ->orderBy('suppliers.name');
        } else {
            $label = $groupBy === 'month'
                ? "DATE_FORMAT(purchase_orders.order_date, '%Y-%m')"
                : 'purchase_orders.order_date';

            $rows->selectRaw("{$label} as label")->groupByRaw($label)->orderByRaw($label);
        }

        return [
            'rows' => $rows->selectRaw($metrics)->get(),
            'totals' => $base()->selectRaw($metrics)->first(),
        ];
    }

    /**
     * Piutang + umur piutang (aging), snapshot hari ini.
     * Umur dihitung dari jatuh tempo; belum jatuh tempo masuk "not_due".
     */
    public function receivables(): array
    {
        $today = now()->toDateString();
        $due = 'COALESCE(invoices.due_date, invoices.invoice_date)';
        $out = 'invoices.outstanding_amount';

        $bucket = fn(string $cond, string $alias) =>
            "ROUND(COALESCE(SUM(CASE WHEN {$cond} THEN {$out} ELSE 0 END), 0), 2) as {$alias}";

        $columns = implode(', ', [
            'COUNT(*) as invoice_count',
            $this->sum($out) . ' as outstanding',
            $bucket("DATEDIFF(?, {$due}) <= 0", 'not_due'),
            $bucket("DATEDIFF(?, {$due}) BETWEEN 1 AND 30", 'overdue_1_30'),
            $bucket("DATEDIFF(?, {$due}) BETWEEN 31 AND 60", 'overdue_31_60'),
            $bucket("DATEDIFF(?, {$due}) BETWEEN 61 AND 90", 'overdue_61_90'),
            $bucket("DATEDIFF(?, {$due}) > 90", 'overdue_over_90'),
        ]);
        $bindings = array_fill(0, 5, $today);

        $base = fn() => DB::table('invoices')
            ->where('invoices.status', InvoiceStatus::Active->value)
            ->where('invoices.outstanding_amount', '>', 0);

        $customers = $base()
            ->join('customers', 'customers.id', '=', 'invoices.customer_id')
            ->selectRaw('customers.id as customer_id, customers.name as customer_name, ' . $columns, $bindings)
            ->groupBy('customers.id', 'customers.name')
            ->orderByRaw("SUM({$out}) DESC")
            ->get();

        return [
            'as_of' => $today,
            'totals' => $base()->selectRaw($columns, $bindings)->first(),
            'customers' => $customers,
        ];
    }

    /**
     * Biaya operasional per kategori (yang di-void tidak dihitung).
     */
    public function expenses(string $from, string $to): array
    {
        $base = fn() => DB::table('expenses')
            ->where('status', RecordStatus::Active->value)
            ->whereBetween('expense_date', [$from, $to]);

        $metrics = 'COUNT(*) as expense_count, ' . $this->sum('amount') . ' as total';

        return [
            'rows' => $base()
                ->selectRaw("category as label, {$metrics}")
                ->groupBy('category')
                ->orderByRaw('SUM(amount) DESC')
                ->get(),
            'totals' => $base()->selectRaw($metrics)->first(),
        ];
    }

    /**
     * Kartu stok: saldo awal, mutasi dalam periode (urut waktu), saldo akhir.
     * Saldo diambil dari balance_after di ledger, bukan dihitung ulang.
     */
    public function stockCard(int $productId, int $warehouseId, string $from, string $to, int $perPage): array
    {
        $fromAt = Carbon::parse($from)->startOfDay();
        $toAt = Carbon::parse($to)->endOfDay();

        $ledger = fn() => DB::table('stock_movements')
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId);

        $inRange = fn() => $ledger()->whereBetween('created_at', [$fromAt, $toAt]);

        $opening = $ledger()->where('created_at', '<', $fromAt)->orderByDesc('id')->value('balance_after');
        $closing = $ledger()->where('created_at', '<=', $toAt)->orderByDesc('id')->value('balance_after');

        $totals = $inRange()->selectRaw(
            'ROUND(COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0), 3) as total_in, '
            . 'ROUND(COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0), 3) as total_out'
        )->first();

        $page = $inRange()
            ->select('id', 'created_at', 'type', 'reference_number', 'reason', 'balance_after')
            ->selectRaw('ROUND(CASE WHEN quantity > 0 THEN quantity ELSE 0 END, 3) as qty_in')
            ->selectRaw('ROUND(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END, 3) as qty_out')
            ->orderBy('id')
            ->paginate($perPage);

        return [
            'opening_balance' => $opening ?? '0.000',
            'total_in' => $totals->total_in,
            'total_out' => $totals->total_out,
            'closing_balance' => $closing ?? '0.000',
            'movements' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ];
    }

    /** Nama kolom hanya dari konstanta di kode ini, tidak pernah dari input user. */
    private function sum(string $column): string
    {
        return "ROUND(COALESCE(SUM({$column}), 0), 2)";
    }
}
