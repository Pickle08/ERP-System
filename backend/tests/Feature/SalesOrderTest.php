<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Role;
use App\Models\SalesOrder;
use App\Models\SalesOrderStatusHistory;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockService;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SalesOrderTest extends TestCase
{
    use RefreshDatabase;

    private Customer $customer;
    private Warehouse $warehouse;
    private Product $productA;
    private Product $productB;
    private User $stocker;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);

        $this->warehouse = Warehouse::firstOrFail();
        $this->customer = Customer::create(['code' => 'CUS-T01', 'name' => 'Customer Tes']);

        $base = [
            'category_id' => Category::firstOrFail()->id,
            'unit_id' => Unit::firstOrFail()->id,
            'cost_price' => 1000,
            'sell_price' => 1500,
        ];
        $this->productA = Product::create($base + ['sku' => 'TST-A', 'name' => 'Produk A']);
        $this->productB = Product::create($base + ['sku' => 'TST-B', 'name' => 'Produk B']);

        $this->stocker = User::factory()->create([
            'role_id' => Role::where('slug', 'admin')->value('id'),
            'is_active' => true,
        ]);
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

    private function stockUp(Product $product, int|string $qty): void
    {
        DB::transaction(fn() => app(StockService::class)->record(
            $product->id,
            $this->warehouse->id,
            StockMovementType::StockIn,
            (string) $qty,
            'Stok awal tes',
            $this->stocker->id
        ));
    }

    private function balanceOf(Product $product): ?string
    {
        return StockBalance::where('product_id', $product->id)->first()?->quantity;
    }

    private function line(Product $p, int|float $qty, int|float $price = 1000, int|float $discount = 0): array
    {
        return [
            'product_id' => $p->id,
            'quantity' => $qty,
            'unit_price' => $price,
            'discount_percent' => $discount,
        ];
    }

    private function soPayload(?array $items = null, array $overrides = []): array
    {
        return array_merge([
            'customer_id' => $this->customer->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => '2026-11-17',
            'payment_terms_days' => 30,
            'tax_amount' => 100,
            'items' => $items ?? [
                $this->line($this->productA, 10, 2500, 10),
                $this->line($this->productB, 2.5, 1999.99),
            ],
        ], $overrides);
    }

    private function createSo(array $items, array $overrides = []): int
    {
        $this->actingAsRole('sales');

        return $this->postJson('/api/sales-orders', $this->soPayload($items, $overrides))
            ->assertCreated()
            ->json('data.id');
    }

    private function confirmSo(int $id): void
    {
        $this->actingAsRole('sales');
        $this->postJson("/api/sales-orders/{$id}/confirm")->assertOk();
    }

    private function issueSo(int $id)
    {
        $this->actingAsRole('warehouse');

        return $this->postJson("/api/sales-orders/{$id}/issue");
    }

    public function test_create_so_calculates_totals_with_discount(): void
    {
        $this->actingAsRole('sales');

        // A: 10 x 2500 - 10% = 22500.00 ; B: 2.5 x 1999.99 = 4999.975 -> 4999.98
        $this->postJson('/api/sales-orders', $this->soPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.items.0.line_total', '22500.00')
            ->assertJsonPath('data.items.1.line_total', '4999.98')
            ->assertJsonPath('data.subtotal', '27499.98')
            ->assertJsonPath('data.total', '27599.98');

        $so = SalesOrder::firstOrFail();
        $this->assertMatchesRegularExpression('/^SO-\d{6}-0001$/', $so->so_number);
    }

    public function test_rejects_invalid_lines(): void
    {
        $this->actingAsRole('sales');

        $this->postJson('/api/sales-orders', $this->soPayload([$this->line($this->productA, 1, 1000, 101)]))
            ->assertStatus(422)->assertJsonValidationErrors('items.0.discount_percent');

        $this->postJson('/api/sales-orders', $this->soPayload([$this->line($this->productA, 0)]))
            ->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');

        $this->postJson('/api/sales-orders', $this->soPayload([]))
            ->assertStatus(422)->assertJsonValidationErrors('items');

        $this->assertDatabaseCount('sales_orders', 0);
    }

    public function test_confirm_rejects_when_stock_is_insufficient(): void
    {
        $this->stockUp($this->productA, 3);
        $id = $this->createSo([$this->line($this->productA, 5)]);

        $this->actingAsRole('sales');
        $this->postJson("/api/sales-orders/{$id}/confirm")
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');

        $this->assertSame('draft', SalesOrder::findOrFail($id)->status->value);
    }

    public function test_overselling_is_blocked_at_issue_not_at_confirm(): void
    {
        $this->stockUp($this->productA, 10);

        $first = $this->createSo([$this->line($this->productA, 8)]);
        $second = $this->createSo([$this->line($this->productA, 8)]);

        // Tanpa reservasi: keduanya lolos konfirmasi, stok belum berubah.
        $this->confirmSo($first);
        $this->confirmSo($second);
        $this->assertSame('10.000', $this->balanceOf($this->productA));

        $this->issueSo($first)->assertOk();
        $this->assertSame('2.000', $this->balanceOf($this->productA));

        // SO kedua ditolak saat barang keluar. Stok tidak pernah negatif.
        $this->issueSo($second)->assertStatus(422)->assertJsonValidationErrors('quantity');
        $this->assertSame('2.000', $this->balanceOf($this->productA));
        $this->assertSame('confirmed', SalesOrder::findOrFail($second)->status->value);
    }

    public function test_full_flow_issue_deducts_stock_and_creates_invoice(): void
    {
        $this->stockUp($this->productA, 20);
        $this->stockUp($this->productB, 10);

        $id = $this->createSo([
            $this->line($this->productA, 5, 2000),
            $this->line($this->productB, 2, 1000),
        ]);
        $this->confirmSo($id);

        $this->issueSo($id)
            ->assertOk()
            ->assertJsonPath('data.status', 'issued')
            ->assertJsonPath('data.invoice.payment_status', 'unpaid');

        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame('8.000', $this->balanceOf($this->productB));
        $this->assertSame(2, StockMovement::where('type', 'sales_issue')->count());

        // subtotal 10000 + 2000 = 12000.00 ; tax 100 -> total 12100.00
        $invoice = Invoice::firstOrFail();
        $this->assertMatchesRegularExpression('/^INV-\d{6}-0001$/', $invoice->invoice_number);
        $this->assertSame('12000.00', $invoice->subtotal);
        $this->assertSame('12100.00', $invoice->total);
        $this->assertSame('0.00', $invoice->paid_amount);
        $this->assertSame('active', $invoice->status->value);
        $this->assertSame(
            $invoice->invoice_date->copy()->addDays(30)->format('Y-m-d'),
            $invoice->due_date->format('Y-m-d')
        );

        // null -> draft, draft -> confirmed, confirmed -> issued
        $this->assertSame(3, SalesOrderStatusHistory::where('sales_order_id', $id)->count());

        $this->actingAsRole('finance');
        $this->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.invoice_number', $invoice->invoice_number)
            ->assertJsonPath('data.total', '12100.00')
            ->assertJsonCount(2, 'data.sales_order.items');
    }

    public function test_issue_is_all_or_nothing(): void
    {
        $this->stockUp($this->productA, 20);
        $this->stockUp($this->productB, 2);

        $first = $this->createSo([$this->line($this->productA, 5), $this->line($this->productB, 2)]);
        $second = $this->createSo([$this->line($this->productA, 5), $this->line($this->productB, 2)]);
        $this->confirmSo($first);
        $this->confirmSo($second);

        $this->issueSo($first)->assertOk();
        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame('0.000', $this->balanceOf($this->productB));

        // Produk A sempat dikurangi, lalu B gagal: A HARUS balik ke 15.
        $this->issueSo($second)->assertStatus(422);

        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame('0.000', $this->balanceOf($this->productB));
        $this->assertSame('confirmed', SalesOrder::findOrFail($second)->status->value);
        $this->assertSame(1, Invoice::count());
        $this->assertSame(2, StockMovement::where('type', 'sales_issue')->count());
    }

    public function test_issuing_twice_does_not_deduct_stock_twice(): void
    {
        $this->stockUp($this->productA, 20);
        $id = $this->createSo([$this->line($this->productA, 5)]);
        $this->confirmSo($id);

        $this->issueSo($id)->assertOk();
        $this->issueSo($id)->assertStatus(409);

        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame(1, Invoice::count());
    }

    public function test_cancel_before_issue_has_no_stock_effect(): void
    {
        $this->stockUp($this->productA, 10);

        $draft = $this->createSo([$this->line($this->productA, 4)]);
        $confirmed = $this->createSo([$this->line($this->productA, 4)]);
        $this->confirmSo($confirmed);

        $this->actingAsRole('sales');
        $this->postJson("/api/sales-orders/{$draft}/cancel", [])
            ->assertStatus(422)->assertJsonValidationErrors('note');

        $this->postJson("/api/sales-orders/{$draft}/cancel", ['note' => 'Customer batal'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->postJson("/api/sales-orders/{$confirmed}/cancel", ['note' => 'Customer batal'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertSame('10.000', $this->balanceOf($this->productA));
        $this->assertDatabaseCount('stock_movements', 1); // hanya stok awal
    }

    public function test_cancel_issued_so_returns_stock_and_voids_invoice(): void
    {
        $this->stockUp($this->productA, 20);
        $id = $this->createSo([$this->line($this->productA, 5)]);
        $this->confirmSo($id);
        $this->issueSo($id)->assertOk();
        $this->assertSame('15.000', $this->balanceOf($this->productA));

        $this->actingAsRole('admin');
        $this->postJson("/api/sales-orders/{$id}/cancel", ['note' => 'Barang dikembalikan'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertSame('20.000', $this->balanceOf($this->productA));
        $this->assertSame(1, StockMovement::where('type', 'sales_cancel')->count());

        $invoice = Invoice::firstOrFail();
        $this->assertSame('void', $invoice->status->value);
        $this->assertNotNull($invoice->voided_at);
    }

    public function test_only_admin_can_cancel_issued_so(): void
    {
        $this->stockUp($this->productA, 20);
        $id = $this->createSo([$this->line($this->productA, 5)]);
        $this->confirmSo($id);
        $this->issueSo($id)->assertOk();

        $this->actingAsRole('sales');
        $this->postJson("/api/sales-orders/{$id}/cancel", ['note' => 'Salah input'])->assertForbidden();

        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame('issued', SalesOrder::findOrFail($id)->status->value);
    }

    public function test_cannot_cancel_issued_so_when_invoice_has_payment(): void
    {
        $this->stockUp($this->productA, 20);
        $id = $this->createSo([$this->line($this->productA, 5)]);
        $this->confirmSo($id);
        $this->issueSo($id)->assertOk();

        Invoice::query()->update(['paid_amount' => 1000, 'payment_status' => 'partial']);

        $this->actingAsRole('admin');
        $this->postJson("/api/sales-orders/{$id}/cancel", ['note' => 'Batal'])->assertStatus(409);

        $this->assertSame('15.000', $this->balanceOf($this->productA));
        $this->assertSame('issued', SalesOrder::findOrFail($id)->status->value);
        $this->assertSame('active', Invoice::firstOrFail()->status->value);
    }

    public function test_update_only_allowed_in_draft(): void
    {
        $this->stockUp($this->productA, 20);
        $id = $this->createSo([$this->line($this->productA, 2)]);

        $this->actingAsRole('sales');
        $this->putJson("/api/sales-orders/{$id}", $this->soPayload(
            [$this->line($this->productA, 4)],
            ['tax_amount' => 0],
        ))
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.subtotal', '4000.00')
            ->assertJsonPath('data.total', '4000.00');

        $this->confirmSo($id);

        $this->actingAsRole('sales');
        $this->putJson("/api/sales-orders/{$id}", $this->soPayload([$this->line($this->productA, 1)]))
            ->assertStatus(409);
    }

    public function test_role_permissions(): void
    {
        $this->actingAsRole('warehouse');
        $this->postJson('/api/sales-orders', $this->soPayload([$this->line($this->productA, 1)]))
            ->assertForbidden();

        $id = $this->createSo([$this->line($this->productA, 1)]);

        $this->actingAsRole('sales');
        $this->postJson("/api/sales-orders/{$id}/issue")->assertForbidden();

        $this->actingAsRole('procurement');
        $this->getJson('/api/sales-orders')->assertForbidden();

        $this->actingAsRole('warehouse');
        $this->getJson('/api/sales-orders')->assertOk();
        $this->getJson('/api/invoices')->assertForbidden();

        $this->actingAsRole('finance');
        $this->getJson('/api/invoices')->assertOk();
    }
}
