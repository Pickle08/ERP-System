<?php

namespace App\Http\Controllers\Api;

use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StockMovementRequest;
use App\Http\Resources\StockLevelResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StockController extends Controller
{
    // Daftar produk + stok saat ini
    public function index(Request $request): AnonymousResourceCollection
    {
        $products = Product::query()
            ->with('unit:id,code')
            ->withSum('stockBalances as stock_quantity', 'quantity')
            ->when($request->query('search'), function ($q, $s) {
                $q->where(fn($w) => $w->where('name', 'like', "%{$s}%")
                    ->orWhere('sku', 'like', "%{$s}%"));
            })
            ->when($request->query('category_id'), fn($q, $id) => $q->where('category_id', $id))
            ->when($request->has('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return StockLevelResource::collection($products);
    }

    // Riwayat pergerakan stok per produk (terbaru di atas)
    public function movements(Request $request, Product $product): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::enum(StockMovementType::class)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $movements = StockMovement::query()
            ->where('product_id', $product->id)
            ->with(['warehouse:id,code,name', 'creator:id,name'])
            ->when($filters['type'] ?? null, fn($q, $t) => $q->where('type', $t))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('created_at', '>=', Carbon::parse($d)->startOfDay()))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('created_at', '<=', Carbon::parse($d)->endOfDay()))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return StockMovementResource::collection($movements);
    }

    public function stockIn(StockMovementRequest $request, StockService $stock): JsonResponse
    {
        return $this->move($request, $stock, StockMovementType::StockIn);
    }

    public function stockOut(StockMovementRequest $request, StockService $stock): JsonResponse
    {
        return $this->move($request, $stock, StockMovementType::StockOut);
    }

    private function move(StockMovementRequest $request, StockService $stock, StockMovementType $type): JsonResponse
    {
        $data = $request->validated();

        $quantity = (string) $data['quantity'];
        $delta = $type === StockMovementType::StockOut ? '-' . $quantity : $quantity;

        $movement = DB::transaction(fn() => $stock->record(
            productId: (int) $data['product_id'],
            warehouseId: (int) $data['warehouse_id'],
            type: $type,
            delta: $delta,
            reason: $data['reason'],
            userId: $request->user()->id,
            referenceNumber: $data['reference_number'] ?? null,
            notes: $data['notes'] ?? null,
        ));

        $movement->load(['product', 'warehouse:id,code,name', 'creator:id,name']);

        return (new StockMovementResource($movement))->response()->setStatusCode(201);
    }
}
