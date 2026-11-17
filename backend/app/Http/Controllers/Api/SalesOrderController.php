<?php

namespace App\Http\Controllers\Api;

use App\Enums\SalesOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\SalesOrderRequest;
use App\Http\Resources\SalesOrderResource;
use App\Models\SalesOrder;
use App\Services\SalesOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class SalesOrderController extends Controller
{
    private const DETAIL = [
        'customer:id,code,name',
        'warehouse:id,code,name',
        'items.product:id,sku,name',
        'invoice',
        'statusHistories.changer:id,name',
        'creator:id,name',
        'confirmer:id,name',
        'issuer:id,name',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(SalesOrderStatus::class)],
            'customer_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $orders = SalesOrder::query()
            ->with(['customer:id,code,name', 'warehouse:id,code,name'])
            ->withCount('items')
            ->when($request->query('search'), fn($q, $s) => $q->where('so_number', 'like', "%{$s}%"))
            ->when($filters['status'] ?? null, fn($q, $v) => $q->where('status', $v))
            ->when($filters['customer_id'] ?? null, fn($q, $v) => $q->where('customer_id', $v))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('order_date', '>=', $d))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('order_date', '<=', $d))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return SalesOrderResource::collection($orders);
    }

    public function show(SalesOrder $salesOrder): SalesOrderResource
    {
        return $this->detail($salesOrder);
    }

    public function store(SalesOrderRequest $request, SalesOrderService $service): JsonResponse
    {
        $so = $service->create($request->validated(), $request->user());

        return $this->detail($so)->response()->setStatusCode(201);
    }

    public function update(SalesOrderRequest $request, SalesOrder $salesOrder, SalesOrderService $service): SalesOrderResource
    {
        return $this->detail($service->update($salesOrder, $request->validated()));
    }

    public function confirm(Request $request, SalesOrder $salesOrder, SalesOrderService $service): SalesOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        return $this->detail($service->confirm($salesOrder, $request->user(), $data['note'] ?? null));
    }

    public function issue(Request $request, SalesOrder $salesOrder, SalesOrderService $service): SalesOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        return $this->detail($service->issue($salesOrder, $request->user(), $data['note'] ?? null));
    }

    public function cancel(Request $request, SalesOrder $salesOrder, SalesOrderService $service): SalesOrderResource
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:255']]);

        return $this->detail($service->cancel($salesOrder, $request->user(), $data['note']));
    }

    private function detail(SalesOrder $so): SalesOrderResource
    {
        // refresh() penting: subtotal/total dihitung database.
        return new SalesOrderResource($so->refresh()->load(self::DETAIL));
    }
}
