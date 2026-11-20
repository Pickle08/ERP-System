<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WarehouseTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_only_active_warehouses(): void
    {
        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);
        Warehouse::create(['code' => 'WH-OLD', 'name' => 'Gudang Lama', 'is_active' => false]);

        Sanctum::actingAs(User::factory()->create([
            'role_id' => Role::where('slug', 'sales')->value('id'),
            'is_active' => true,
        ]));

        $this->getJson('/api/warehouses')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'WH-MAIN');
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/warehouses')->assertUnauthorized();
    }
}
