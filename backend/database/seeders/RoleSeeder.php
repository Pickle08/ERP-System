<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            'admin' => 'Admin',
            'sales' => 'Sales',
            'warehouse' => 'Gudang',
            'procurement' => 'Procurement',
            'finance' => 'Finance',
            'owner' => 'Owner',
        ];

        foreach ($roles as $slug => $name) {
            \App\Models\Role::updateOrCreate(['slug' => $slug], ['name' => $name]);
        }
    }
}
