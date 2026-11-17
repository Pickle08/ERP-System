<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('type', 30);
            $table->decimal('quantity', 15, 3);       // bertanda: + masuk, - keluar
            $table->decimal('balance_after', 15, 3);  // saldo setelah movement ini
            $table->string('reason', 255);
            $table->string('reference_type', 50)->nullable(); // nanti: purchase_order, sales_order
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_number', 50)->nullable(); // nomor dokumen
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent(); // ledger immutable: tanpa updated_at

            $table->index(['product_id', 'warehouse_id', 'id']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
