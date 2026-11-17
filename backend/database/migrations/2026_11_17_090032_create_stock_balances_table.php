<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 15, 3)->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'warehouse_id']);
        });

        // Jaring pengaman: stok tidak boleh negatif walau ada bug di aplikasi.
        // Butuh MySQL >= 8.0.16 (atau MariaDB >= 10.2) supaya benar-benar di-enforce.
        DB::statement(
            'ALTER TABLE stock_balances
             ADD CONSTRAINT chk_stock_balances_qty_non_negative CHECK (quantity >= 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_balances');
    }
};
