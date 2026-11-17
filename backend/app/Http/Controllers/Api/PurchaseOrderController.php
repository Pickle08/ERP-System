<?php

namespace App\Http\Controllers\Api;

use App\Enums\PurchaseOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    private const DETAIL = [
        'supplier:id,code,name',
        'warehouse:id,code,name',
        'items.product:id,sku,name',
        'statusHistories.changer:id,name',
        'creator:id,name',
        'approver:id,name',
        'receiver:id,name',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(PurchaseOrderStatus::class)],
            'supplier_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $orders = PurchaseOrder::query()
            ->with(['supplier:id,code,name', 'warehouse:id,code,name'])
            ->withCount('items')
            ->when($request->query('search'), fn($q, $s) => $q->where('po_number', 'like', "%{$s}%"))
            ->when($filters['status'] ?? null, fn($q, $v) => $q->where('status', $v))
            ->when($filters['supplier_id'] ?? null, fn($q, $v) => $q->where('supplier_id', $v))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('order_date', '>=', $d))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('order_date', '<=', $d))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return PurchaseOrderResource::collection($orders);
    }

    public function show(PurchaseOrder $purchaseOrder): PurchaseOrderResource
    {
        return $this->detail($purchaseOrder);
    }

    public function store(PurchaseOrderRequest $request, PurchaseOrderService $service): JsonResponse
    {
        $po = $service->create($request->validated(), $request->user());

        return $this->detail($po)->response()->setStatusCode(201);
    }

    public function update(PurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): PurchaseOrderResource
    {
        return $this->detail($service->update($purchaseOrder, $request->validated()));
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): PurchaseOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        return $this->detail($service->approve($purchaseOrder, $request->user(), $data['note'] ?? null));
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): PurchaseOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        return $this->detail($service->receive($purchaseOrder, $request->user(), $data['note'] ?? null));
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): PurchaseOrderResource
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:255']]);

        return $this->detail($service->cancel($purchaseOrder, $request->user(), $data['note']));
    }

    private function detail(PurchaseOrder $po): PurchaseOrderResource
    {
        // refresh() penting: subtotal/total dihitung database, jadi harus dibaca ulang.
        return new PurchaseOrderResource($po->refresh()->load(self::DETAIL));
    }
}
