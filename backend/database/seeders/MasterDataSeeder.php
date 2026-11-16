<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Category;
use App\Models\Unit;
use App\Models\Warehouse;

class MasterDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Warehouse::updateOrCreate(
            ['code' => 'WH-MAIN'],
            ['name' => 'Gudang Utama', 'is_active' => true]
        );

        $units = ['pcs' => 'Pieces', 'box' => 'Box', 'kg' => 'Kilogram', 'ltr' => 'Liter', 'pack' => 'Pack'];
        foreach ($units as $code => $name) {
            Unit::updateOrCreate(['code' => $code], ['name' => $name]);
        }

        foreach (['Elektronik', 'Alat Tulis', 'Makanan & Minuman', 'Perlengkapan Rumah Tangga'] as $name) {
            Category::updateOrCreate(['name' => $name]);
        }
    }
}
