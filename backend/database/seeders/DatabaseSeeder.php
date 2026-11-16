<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        foreach (\App\Models\Role::all() as $role) {
            \App\Models\User::updateOrCreate(
                ['email' => "{$role->slug}@erp.test"],
                [
                    'name' => "{$role->name} Demo",
                    'password' => \Illuminate\Support\Facades\Hash::make('password'),
                    'role_id' => $role->id,
                    'is_active' => true,
                ]
            );
        }
    }
}
