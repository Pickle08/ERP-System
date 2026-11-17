<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UnitController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StockController;

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
});
