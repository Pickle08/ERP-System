<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['status', 'invoice_date']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->index(['status', 'order_date']);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['status', 'invoice_date']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['status', 'order_date']);
        });
    }
};
