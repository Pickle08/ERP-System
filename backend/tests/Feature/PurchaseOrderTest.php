<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderStatusHistory;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
{
    use RefreshDatabase;

    private Supplier $supplier;
    private Warehouse $warehouse;
    private Product $productA;
    private Product $productB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);

        $this->warehouse = Warehouse::firstOrFail();
        $this->supplier = Supplier::create(['code' => 'SUP-T01', 'name' => 'Supplier Tes']);

        $base = [
            'category_id' => Category::firstOrFail()->id,
            'unit_id' => Unit::firstOrFail()->id,
            'cost_price' => 1000,
            'sell_price' => 1500,
        ];
        $this->productA = Product::create($base + ['sku' => 'TST-A', 'name' => 'Produk A']);
        $this->productB = Product::create($base + ['sku' => 'TST-B', 'name' => 'Produk B']);
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

    private function poPayload(array $overrides = []): array
    {
        return array_merge([
            'supplier_id' => $this->supplier->id,
            'warehouse_id' => $this->warehouse->id,
            'order_date' => '2026-11-17',
            'tax_amount' => 100,
            'items' => [
                ['product_id' => $this->productA->id, 'quantity' => 10, 'unit_price' => 2500],
                ['product_id' => $this->productB->id, 'quantity' => 2.5, 'unit_price' => 1999.99],
            ],
        ], $overrides);
    }

    private function createPo(array $overrides = []): int
    {
        return $this->postJson('/api/purchase-orders', $this->poPayload($overrides))
            ->assertCreated()
            ->json('data.id');
    }

    private function balanceOf(Product $product): ?string
    {
        return StockBalance::where('product_id', $product->id)->first()?->quantity;
    }

    public function test_create_po_calculates_totals_in_backend(): void
    {
        $this->actingAsRole('procurement');

        // 10 x 2500 = 25000.00 ; 2.5 x 1999.99 = 4999.975 -> dibulatkan 4999.98
        $this->postJson('/api/purchase-orders', $this->poPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.items.0.line_total', '25000.00')
            ->assertJsonPath('data.items.1.line_total', '4999.98')
            ->assertJsonPath('data.subtotal', '29999.98')
            ->assertJsonPath('data.tax_amount', '100.00')
            ->assertJsonPath('data.total', '30099.98');
    }

    public function test_po_numbers_are_sequential(): void
    {
        $this->actingAsRole('procurement');

        $first = $this->postJson('/api/purchase-orders', $this->poPayload())->assertCreated()->json('data.po_number');
        $second = $this->postJson('/api/purchase-orders', $this->poPayload())->assertCreated()->json('data.po_number');

        $this->assertMatchesRegularExpression('/^PO-\d{6}-0001$/', $first);
        $this->assertMatchesRegularExpression('/^PO-\d{6}-0002$/', $second);
    }

    public function test_rejects_invalid_lines(): void
    {
        $this->actingAsRole('procurement');
        $a = $this->productA->id;

        $this->postJson('/api/purchase-orders', $this->poPayload([
            'items' => [['product_id' => $a, 'quantity' => 1, 'unit_price' => -1]],
        ]))->assertStatus(422)->assertJsonValidationErrors('items.0.unit_price');

        $this->postJson('/api/purchase-orders', $this->poPayload([
            'items' => [['product_id' => $a, 'quantity' => 0, 'unit_price' => 1000]],
        ]))->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');

        $this->postJson('/api/purchase-orders', $this->poPayload([
            'items' => [
                ['product_id' => $a, 'quantity' => 1, 'unit_price' => 1000],
                ['product_id' => $a, 'quantity' => 2, 'unit_price' => 1000],
            ],
        ]))->assertStatus(422)->assertJsonValidationErrors('items.1.product_id');

        $this->postJson('/api/purchase-orders', $this->poPayload(['items' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('items');

        $this->assertDatabaseCount('purchase_orders', 0);
    }

    public function test_full_flow_receive_increases_stock(): void
    {
        $this->actingAsRole('procurement');
        $id = $this->createPo();

        $this->actingAsRole('owner');
        $this->postJson("/api/purchase-orders/{$id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        // Approve belum boleh menyentuh stok
        $this->assertDatabaseCount('stock_movements', 0);

        $this->actingAsRole('warehouse');
        $this->postJson("/api/purchase-orders/{$id}/receive")
            ->assertOk()
            ->assertJsonPath('data.status', 'received');

        $po = PurchaseOrder::findOrFail($id);

        $this->assertSame('10.000', $this->balanceOf($this->productA));
        $this->assertSame('2.500', $this->balanceOf($this->productB));

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->productA->id,
            'type' => 'purchase_receipt',
            'reference_type' => 'purchase_order',
            'reference_id' => $id,
            'reference_number' => $po->po_number,
        ]);

        // null -> draft, draft -> approved, approved -> received
        $this->assertSame(3, PurchaseOrderStatusHistory::where('purchase_order_id', $id)->count());
    }

    public function test_cannot_receive_draft_po(): void
    {
        $this->actingAsRole('procurement');
        $id = $this->createPo();

        $this->actingAsRole('warehouse');
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertStatus(409);

        $this->assertDatabaseCount('stock_movements', 0);
        $this->assertSame('draft', PurchaseOrder::findOrFail($id)->status->value);
    }

    public function test_receiving_twice_does_not_double_stock(): void
    {
        $this->actingAsRole('procurement');
        $id = $this->createPo();

        $this->actingAsRole('admin');
        $this->postJson("/api/purchase-orders/{$id}/approve")->assertOk();
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertOk();
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertStatus(409);

        $this->assertSame('10.000', $this->balanceOf($this->productA));
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_cancel_requires_note_and_blocks_receive(): void
    {
        $this->actingAsRole('procurement');
        $id = $this->createPo();

        $this->postJson("/api/purchase-orders/{$id}/cancel", [])
            ->assertStatus(422)->assertJsonValidationErrors('note');

        $this->postJson("/api/purchase-orders/{$id}/cancel", ['note' => 'Supplier batal kirim'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->actingAsRole('admin');
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertStatus(409);

        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_received_po_cannot_be_cancelled(): void
    {
        $this->actingAsRole('admin');
        $id = $this->createPo();
        $this->postJson("/api/purchase-orders/{$id}/approve")->assertOk();
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertOk();

        $this->postJson("/api/purchase-orders/{$id}/cancel", ['note' => 'Salah input'])->assertStatus(409);

        $this->assertSame('10.000', $this->balanceOf($this->productA));
    }

    public function test_update_only_allowed_in_draft(): void
    {
        $this->actingAsRole('procurement');
        $id = $this->createPo();

        $this->putJson("/api/purchase-orders/{$id}", $this->poPayload([
            'tax_amount' => 0,
            'items' => [['product_id' => $this->productA->id, 'quantity' => 4, 'unit_price' => 1000]],
        ]))
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.subtotal', '4000.00')
            ->assertJsonPath('data.total', '4000.00');

        $this->actingAsRole('admin');
        $this->postJson("/api/purchase-orders/{$id}/approve")->assertOk();

        $this->actingAsRole('procurement');
        $this->putJson("/api/purchase-orders/{$id}", $this->poPayload())->assertStatus(409);
    }

    public function test_role_permissions(): void
    {
        $this->actingAsRole('warehouse');
        $this->postJson('/api/purchase-orders', $this->poPayload())->assertForbidden();

        $this->actingAsRole('procurement');
        $id = $this->createPo();
        $this->postJson("/api/purchase-orders/{$id}/approve")->assertForbidden();

        $this->actingAsRole('owner');
        $this->postJson("/api/purchase-orders/{$id}/approve")->assertOk();

        $this->actingAsRole('procurement');
        $this->postJson("/api/purchase-orders/{$id}/receive")->assertForbidden();

        $this->actingAsRole('sales');
        $this->getJson('/api/purchase-orders')->assertForbidden();
    }

    public function test_index_filters_by_status(): void
    {
        $this->actingAsRole('admin');
        $this->createPo();
        $approvedId = $this->createPo();
        $this->postJson("/api/purchase-orders/{$approvedId}/approve")->assertOk();

        $this->getJson('/api/purchase-orders')->assertOk()->assertJsonCount(2, 'data');

        $this->getJson('/api/purchase-orders?status=approved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $approvedId);
    }
}
