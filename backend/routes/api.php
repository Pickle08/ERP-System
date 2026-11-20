<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UnitController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\SalesOrderController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\WarehouseController;

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // READ: semua user yang login
    Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);
    Route::apiResource('units', UnitController::class)->only(['index', 'show']);
    Route::apiResource('suppliers', SupplierController::class)->only(['index', 'show']);
    Route::apiResource('customers', CustomerController::class)->only(['index', 'show']);
    Route::apiResource('products', ProductController::class)->only(['index', 'show']);

    // WRITE: admin + procurement (produk, kategori, satuan, supplier)
    Route::middleware('role:admin,procurement')->group(function () {
        Route::apiResource('categories', CategoryController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('units', UnitController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('suppliers', SupplierController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('products', ProductController::class)->only(['store', 'update', 'destroy']);
    });

    // WRITE: admin + sales (customer)
    Route::middleware('role:admin,sales')->group(function () {
        Route::apiResource('customers', CustomerController::class)->only(['store', 'update', 'destroy']);
    });

    // INVENTORY: baca = semua user login, tulis = admin + gudang
    Route::get('/stocks', [StockController::class, 'index']);
    Route::get('/stocks/{product}/movements', [StockController::class, 'movements'])->withTrashed();

    Route::middleware('role:admin,warehouse')->group(function () {
        Route::post('/stocks/in', [StockController::class, 'stockIn']);
        Route::post('/stocks/out', [StockController::class, 'stockOut']);
    });

    Route::get('/warehouses', [WarehouseController::class, 'index']);

    // PURCHASE ORDER
    Route::middleware('role:admin,procurement,warehouse,finance,owner')->group(function () {
        Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
        Route::get('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
    });

    Route::middleware('role:admin,procurement')->group(function () {
        Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
        Route::put('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
        Route::post('/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);
    });

    Route::post('/purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])
        ->middleware('role:admin,owner');

    Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])
        ->middleware('role:admin,warehouse');

    // SALES ORDER
    Route::middleware('role:admin,sales,warehouse,finance,owner')->group(function () {
        Route::get('/sales-orders', [SalesOrderController::class, 'index']);
        Route::get('/sales-orders/{salesOrder}', [SalesOrderController::class, 'show']);
    });

    // Cancel SO yang sudah issued dibatasi admin di dalam service
    Route::middleware('role:admin,sales')->group(function () {
        Route::post('/sales-orders', [SalesOrderController::class, 'store']);
        Route::put('/sales-orders/{salesOrder}', [SalesOrderController::class, 'update']);
        Route::post('/sales-orders/{salesOrder}/confirm', [SalesOrderController::class, 'confirm']);
        Route::post('/sales-orders/{salesOrder}/cancel', [SalesOrderController::class, 'cancel']);
    });

    Route::post('/sales-orders/{salesOrder}/issue', [SalesOrderController::class, 'issue'])
        ->middleware('role:admin,warehouse');

    // INVOICE (baca saja; pembayaran menyusul di modul Finance)
    Route::middleware('role:admin,sales,finance,owner')->group(function () {
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
    });

    // FINANCE: baca = admin, finance, owner; tulis = admin, finance
    Route::middleware('role:admin,finance,owner')->group(function () {
        Route::get('/payments', [PaymentController::class, 'index']);
        Route::get('/payments/{payment}', [PaymentController::class, 'show']);
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::get('/expenses/{expense}', [ExpenseController::class, 'show']);
    });

    Route::middleware('role:admin,finance')->group(function () {
        Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store']);
        Route::post('/payments/{payment}/void', [PaymentController::class, 'void']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::post('/expenses/{expense}/void', [ExpenseController::class, 'void']);
    });

    // REPORTS
    Route::middleware('role:admin,finance,owner')->prefix('reports')->group(function () {
        Route::get('/summary', [ReportController::class, 'summary']);
        Route::get('/sales', [ReportController::class, 'sales']);
        Route::get('/purchases', [ReportController::class, 'purchases']);
        Route::get('/receivables', [ReportController::class, 'receivables']);
        Route::get('/expenses', [ReportController::class, 'expenses']);
    });

    Route::get('/reports/stock-card', [ReportController::class, 'stockCard'])
        ->middleware('role:admin,warehouse,finance,owner');
});
