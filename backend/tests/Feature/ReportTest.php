<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $warehouse;
    private Supplier $supplier;
    private Customer $c1;
    private Customer $c2;
    private Product $a;
    private Product $b;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);

        $this->warehouse = Warehouse::firstOrFail();
        $this->supplier = Supplier::create(['code' => 'SUP-T01', 'name' => 'Supplier Tes']);
        $this->c1 = Customer::create(['code' => 'CUS-T01', 'name' => 'Customer Satu']);
        $this->c2 = Customer::create(['code' => 'CUS-T02', 'name' => 'Customer Dua']);

        $base = [
            'category_id' => Category::firstOrFail()->id,
            'unit_id' => Unit::firstOrFail()->id,
            'cost_price' => 1000,
            'sell_price' => 1500,
        ];
        // A: stok minimum 10, supaya masuk laporan stok menipis
        $this->a = Product::create($base + ['sku' => 'TST-A', 'name' => 'Produk A', 'min_stock' => 10]);
        $this->b = Product::create($base + ['sku' => 'TST-B', 'name' => 'Produk B']);
    }

    private function actingAsRole(string $slug): User
    {
        $user = User::factory()->create([
            'role_id' => Role::where('slug', $slug)->value('id'),
            'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function today(): string
    {
        return now()->toDateString();
    }

    private function tomorrow(): string
    {
        return now()->addDay()->toDateString();
    }

    private function poPayload(int $qty): array
    {
        return [
            'supplier_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => $this->today(),
            'items' => [['product_id' => $this->a->id, 'quantity' => $qty, 'unit_price' => 1000]],
        ];
    }

    private function issueSalesOrder(Customer $customer, Product $product, int $qty, int $price): int
    {
        $id = $this->postJson('/api/sales-orders', [
            'customer_id' => $customer->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => $this->today(),
            'items' => [['product_id' => $product->id, 'quantity' => $qty, 'unit_price' => $price]],
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/sales-orders/{$id}/confirm")->assertOk();
        $this->postJson("/api/sales-orders/{$id}/issue")->assertOk();

        return $id;
    }

    /**
     * Data lewat alur API sungguhan, jadi laporan dites terhadap transaksi tersimpan:
     *
     *  Pembelian : PO received 10 x 1000 = 10000 ; PO draft 3 x 1000 = 3000 (tidak terhitung)
     *  Penjualan : SO1 (Customer Satu) 4 x 2000 = 8000, dibayar 3000
     *              SO2 (Customer Dua)  5 x 1000 = 5000, jatuh tempo 45 hari lalu
     *              SO3 (Customer Satu) 2 x 2000 = 4000, dibatalkan -> invoice void
     *  Biaya     : transport 150000 + rent 500000 ; satu biaya 999 di-void
     *  Stok A    : +10, -4, -2, +2 = 6        Stok B : +20, -5 = 15
     */
    private function buildScenario(): void
    {
        $this->actingAsRole('admin');
        $today = $this->today();

        $poId = $this->postJson('/api/purchase-orders', $this->poPayload(10))->assertCreated()->json('data.id');
        $this->postJson('/api/purchase-orders', $this->poPayload(3))->assertCreated(); // draft
        $this->postJson("/api/purchase-orders/{$poId}/approve")->assertOk();
        $this->postJson("/api/purchase-orders/{$poId}/receive")->assertOk();

        $this->postJson('/api/stocks/in', [
            'product_id' => $this->b->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity' => 20,
            'reason' => 'Stok awal',
        ])->assertCreated();

        $so1 = $this->issueSalesOrder($this->c1, $this->a, 4, 2000);
        $so2 = $this->issueSalesOrder($this->c2, $this->b, 5, 1000);
        $so3 = $this->issueSalesOrder($this->c1, $this->a, 2, 2000);
        $this->postJson("/api/sales-orders/{$so3}/cancel", ['note' => 'Retur'])->assertOk();

        $inv1 = Invoice::where('sales_order_id', $so1)->firstOrFail();
        $inv2 = Invoice::where('sales_order_id', $so2)->firstOrFail();

        $this->postJson("/api/invoices/{$inv1->id}/payments", [
            'payment_date' => $today,
            'amount' => 3000,
            'method' => 'cash',
        ])->assertCreated();

        $inv2->update(['due_date' => now()->subDays(45)->toDateString()]);

        $this->postJson('/api/expenses', [
            'expense_date' => $today,
            'category' => 'transport',
            'description' => 'Bensin',
            'amount' => 150000,
        ])->assertCreated();
        $this->postJson('/api/expenses', [
            'expense_date' => $today,
            'category' => 'rent',
            'description' => 'Sewa gudang',
            'amount' => 500000,
        ])->assertCreated();
        $voidId = $this->postJson('/api/expenses', [
            'expense_date' => $today,
            'category' => 'other',
            'description' => 'Salah input',
            'amount' => 999,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/expenses/{$voidId}/void", ['reason' => 'Salah input'])->assertOk();
    }

    public function test_summary_is_derived_from_stored_transactions(): void
    {
        $this->buildScenario();
        $today = $this->today();

        $this->getJson("/api/reports/summary?from={$today}&to={$today}")
            ->assertOk()
            // invoice void (SO3) tidak ikut: 8000 + 5000, bukan 17000
            ->assertJsonPath('data.sales.invoice_count', 2)
            ->assertJsonPath('data.sales.total', '13000.00')
            // PO draft tidak ikut
            ->assertJsonPath('data.purchases.order_count', 1)
            ->assertJsonPath('data.purchases.total', '10000.00')
            ->assertJsonPath('data.receivables.invoice_count', 2)
            ->assertJsonPath('data.receivables.outstanding', '10000.00')
            ->assertJsonPath('data.receivables.overdue', '5000.00')
            // biaya void 999 tidak ikut
            ->assertJsonPath('data.expenses.expense_count', 2)
            ->assertJsonPath('data.expenses.total', '650000.00')
            ->assertJsonPath('data.payments_received.total', '3000.00');
    }

    public function test_summary_respects_date_range_but_receivables_is_a_snapshot(): void
    {
        $this->buildScenario();
        $tomorrow = $this->tomorrow();

        $this->getJson("/api/reports/summary?from={$tomorrow}&to={$tomorrow}")
            ->assertOk()
            ->assertJsonPath('data.sales.invoice_count', 0)
            ->assertJsonPath('data.sales.total', '0.00')
            ->assertJsonPath('data.purchases.total', '0.00')
            ->assertJsonPath('data.expenses.total', '0.00')
            ->assertJsonPath('data.payments_received.total', '0.00')
            ->assertJsonPath('data.receivables.outstanding', '10000.00');
    }

    public function test_sales_report_grouping_and_filters(): void
    {
        $this->buildScenario();
        $today = $this->today();
        $range = "from={$today}&to={$today}";

        $this->getJson("/api/reports/sales?{$range}&group_by=customer")
            ->assertOk()
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.label', 'Customer Dua')
            ->assertJsonPath('data.rows.0.total', '5000.00')
            ->assertJsonPath('data.rows.1.label', 'Customer Satu')
            ->assertJsonPath('data.rows.1.total', '8000.00')
            ->assertJsonPath('data.totals.total', '13000.00');

        $this->getJson("/api/reports/sales?{$range}&group_by=day")
            ->assertOk()
            ->assertJsonCount(1, 'data.rows')
            ->assertJsonPath('data.rows.0.label', $today)
            ->assertJsonPath('data.rows.0.invoice_count', 2);

        $this->getJson("/api/reports/sales?{$range}&group_by=month")
            ->assertOk()
            ->assertJsonPath('data.rows.0.label', now()->format('Y-m'));

        $this->getJson("/api/reports/sales?{$range}&payment_status=partial")
            ->assertOk()
            ->assertJsonPath('data.totals.invoice_count', 1)
            ->assertJsonPath('data.totals.total', '8000.00');

        $this->getJson("/api/reports/sales?{$range}&customer_id={$this->c2->id}")
            ->assertOk()
            ->assertJsonPath('data.totals.total', '5000.00');
    }

    public function test_purchases_report_filters_by_status(): void
    {
        $this->buildScenario();
        $today = $this->today();
        $range = "from={$today}&to={$today}";

        $this->getJson("/api/reports/purchases?{$range}")
            ->assertOk()
            ->assertJsonPath('data.status', 'received')
            ->assertJsonPath('data.totals.order_count', 1)
            ->assertJsonPath('data.totals.total', '10000.00');

        $this->getJson("/api/reports/purchases?{$range}&status=draft")
            ->assertOk()
            ->assertJsonPath('data.totals.total', '3000.00');

        $this->getJson("/api/reports/purchases?{$range}&group_by=supplier")
            ->assertOk()
            ->assertJsonPath('data.rows.0.label', 'Supplier Tes')
            ->assertJsonPath('data.rows.0.total', '10000.00');
    }

    public function test_receivables_aging_buckets(): void
    {
        $this->buildScenario();

        // INV1: sisa 5000, jatuh tempo hari ini (belum telat). INV2: sisa 5000, telat 45 hari.
        $this->getJson('/api/reports/receivables')
            ->assertOk()
            ->assertJsonPath('data.totals.invoice_count', 2)
            ->assertJsonPath('data.totals.outstanding', '10000.00')
            ->assertJsonPath('data.totals.not_due', '5000.00')
            ->assertJsonPath('data.totals.overdue_1_30', '0.00')
            ->assertJsonPath('data.totals.overdue_31_60', '5000.00')
            ->assertJsonPath('data.totals.overdue_61_90', '0.00')
            ->assertJsonPath('data.totals.overdue_over_90', '0.00')
            ->assertJsonCount(2, 'data.customers');
    }

    public function test_expenses_report_groups_by_category_and_excludes_void(): void
    {
        $this->buildScenario();
        $today = $this->today();

        $this->getJson("/api/reports/expenses?from={$today}&to={$today}")
            ->assertOk()
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.label', 'rent')
            ->assertJsonPath('data.rows.0.total', '500000.00')
            ->assertJsonPath('data.rows.1.label', 'transport')
            ->assertJsonPath('data.rows.1.total', '150000.00')
            ->assertJsonPath('data.totals.expense_count', 2)
            ->assertJsonPath('data.totals.total', '650000.00');
    }

    public function test_stock_card_has_opening_movements_and_closing(): void
    {
        $this->buildScenario();
        $today = $this->today();
        $url = "/api/reports/stock-card?product_id={$this->a->id}&warehouse_id={$this->warehouse->id}";

        $this->getJson("{$url}&from={$today}&to={$today}")
            ->assertOk()
            ->assertJsonPath('data.product.sku', 'TST-A')
            ->assertJsonPath('data.opening_balance', '0.000')
            ->assertJsonPath('data.total_in', '12.000')
            ->assertJsonPath('data.total_out', '6.000')
            ->assertJsonPath('data.closing_balance', '6.000')
            ->assertJsonCount(4, 'data.movements')
            ->assertJsonPath('data.movements.0.type', 'purchase_receipt')
            ->assertJsonPath('data.movements.0.qty_in', '10.000')
            ->assertJsonPath('data.movements.1.type', 'sales_issue')
            ->assertJsonPath('data.movements.1.qty_out', '4.000')
            ->assertJsonPath('data.movements.3.type', 'sales_cancel')
            ->assertJsonPath('data.movements.3.balance_after', '6.000')
            ->assertJsonPath('data.meta.total', 4);

        // Periode setelah semua mutasi: saldo awal = saldo akhir = 6, tanpa mutasi
        $tomorrow = $this->tomorrow();
        $this->getJson("{$url}&from={$tomorrow}&to={$tomorrow}")
            ->assertOk()
            ->assertJsonPath('data.opening_balance', '6.000')
            ->assertJsonPath('data.total_in', '0.000')
            ->assertJsonPath('data.total_out', '0.000')
            ->assertJsonPath('data.closing_balance', '6.000')
            ->assertJsonCount(0, 'data.movements');
    }

    public function test_low_stock_filter_on_stock_list(): void
    {
        $this->buildScenario();

        // A: stok 6 <= minimum 10 (menipis). B: stok 15, minimum 0 (aman).
        $this->getJson('/api/stocks?low_stock=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'TST-A')
            ->assertJsonPath('data.0.quantity', '6.000');
    }

    public function test_report_permissions(): void
    {
        $stockCard = "/api/reports/stock-card?product_id={$this->a->id}&warehouse_id={$this->warehouse->id}";

        $this->actingAsRole('sales');
        $this->getJson('/api/reports/summary')->assertForbidden();
        $this->getJson($stockCard)->assertForbidden();

        $this->actingAsRole('procurement');
        $this->getJson('/api/reports/summary')->assertForbidden();

        $this->actingAsRole('warehouse');
        $this->getJson('/api/reports/summary')->assertForbidden();
        $this->getJson($stockCard)->assertOk();

        $this->actingAsRole('owner');
        $this->getJson('/api/reports/summary')->assertOk();

        $this->actingAsRole('finance');
        $this->getJson('/api/reports/receivables')->assertOk();
    }

    public function test_report_validation(): void
    {
        $this->actingAsRole('finance');

        $this->getJson('/api/reports/summary?to=abc')
            ->assertStatus(422)->assertJsonValidationErrors('to');

        $this->getJson('/api/reports/summary?from=2026-11-18&to=2026-11-01')
            ->assertStatus(422)->assertJsonValidationErrors('to');

        $this->getJson('/api/reports/sales?group_by=hour')
            ->assertStatus(422)->assertJsonValidationErrors('group_by');

        $this->getJson('/api/reports/stock-card')
            ->assertStatus(422)->assertJsonValidationErrors(['product_id', 'warehouse_id']);

        $this->getJson('/api/reports/stock-card?product_id=999999&warehouse_id=1')
            ->assertStatus(422)->assertJsonValidationErrors('product_id');
    }
}
