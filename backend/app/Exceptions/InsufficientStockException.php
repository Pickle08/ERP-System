<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    public function __construct(public readonly string $productName)
    {
        parent::__construct("Stok tidak cukup untuk produk {$productName}.");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => ['quantity' => [$this->getMessage()]],
        ], 422);
    }
}
