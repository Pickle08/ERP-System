<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);

        $this->warehouse = Warehouse::firstOrFail();
        $this->product = Product::create([
            'sku' => 'TST-001',
            'name' => 'Produk Tes',
            'category_id' => Category::firstOrFail()->id,
            'unit_id' => Unit::firstOrFail()->id,
            'cost_price' => 1000,
            'sell_price' => 1500,
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

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity' => 10,
            'reason' => 'Stok awal',
            'reference_number' => 'DOC-001',
        ], $overrides);
    }

    public function test_stock_in_increases_balance_and_records_movement(): void
    {
        $this->actingAsRole('warehouse');

        $this->postJson('/api/stocks/in', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.quantity', '10.000')
            ->assertJsonPath('data.balance_after', '10.000');

        $this->assertSame('10.000', StockBalance::firstOrFail()->quantity);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_stock_out_cannot_make_stock_negative(): void
    {
        $this->actingAsRole('warehouse');

        $this->postJson('/api/stocks/in', $this->payload(['quantity' => 5]))->assertCreated();

        $this->postJson('/api/stocks/out', $this->payload(['quantity' => 6, 'reason' => 'Rusak']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('quantity');

        // Gagal = saldo tidak berubah dan tidak ada movement nyangkut
        $this->assertSame('5.000', StockBalance::firstOrFail()->quantity);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_balance_matches_sum_of_movements(): void
    {
        $this->actingAsRole('warehouse');

        $this->postJson('/api/stocks/in', $this->payload(['quantity' => 10]))->assertCreated();
        $this->postJson('/api/stocks/out', $this->payload(['quantity' => 3.5, 'reason' => 'Keluar manual']))->assertCreated();
        $this->postJson('/api/stocks/in', $this->payload(['quantity' => 2.25]))->assertCreated();
        $this->postJson('/api/stocks/out', $this->payload(['quantity' => 4, 'reason' => 'Keluar manual']))->assertCreated();

        $this->assertSame('4.750', StockBalance::firstOrFail()->quantity);
        $this->assertEquals(4.75, (float) StockMovement::sum('quantity'));
    }

    public function test_rejects_zero_and_negative_quantity(): void
    {
        $this->actingAsRole('warehouse');

        foreach ([0, -5] as $qty) {
            $this->postJson('/api/stocks/in', $this->payload(['quantity' => $qty]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('quantity');
        }

        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_rejects_unknown_product(): void
    {
        $this->actingAsRole('warehouse');

        $this->postJson('/api/stocks/in', $this->payload(['product_id' => 999999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('product_id');
    }

    public function test_only_admin_and_warehouse_can_move_stock(): void
    {
        foreach (['sales', 'finance', 'procurement', 'owner'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/stocks/in', $this->payload())->assertForbidden();
        }

        $this->actingAsRole('admin');
        $this->postJson('/api/stocks/in', $this->payload())->assertCreated();
    }

    public function test_movement_history_is_listed_newest_first(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/stocks/in', $this->payload(['quantity' => 10]))->assertCreated();
        $this->postJson('/api/stocks/out', $this->payload(['quantity' => 4, 'reason' => 'Keluar manual']))->assertCreated();

        $this->getJson("/api/stocks/{$this->product->id}/movements")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.type', 'stock_out')
            ->assertJsonPath('data.0.quantity', '-4.000')
            ->assertJsonPath('data.0.balance_after', '6.000');
    }

    public function test_stock_list_shows_current_quantity(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/stocks/in', $this->payload(['quantity' => 10]))->assertCreated();

        $this->getJson('/api/stocks?search=TST')
            ->assertOk()
            ->assertJsonPath('data.0.sku', 'TST-001')
            ->assertJsonPath('data.0.quantity', '10.000');
    }
    public function test_product_list_includes_current_stock_quantity(): void
    {
        $this->actingAsRole('warehouse');
        $this->postJson('/api/stocks/in', $this->payload())->assertCreated();

        $this->getJson('/api/products?search=TST')
            ->assertOk()
            ->assertJsonPath('data.0.stock_quantity', '10.000');
    }
}
