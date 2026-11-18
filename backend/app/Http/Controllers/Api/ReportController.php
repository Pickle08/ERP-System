<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function summary(Request $request, ReportService $reports): JsonResponse
    {
        [$from, $to] = $this->range($request);

        return response()->json(['data' => $reports->summary($from, $to)]);
    }

    public function sales(Request $request, ReportService $reports): JsonResponse
    {
        [$from, $to, $data] = $this->range($request, [
            'group_by' => ['nullable', Rule::in(['day', 'month', 'customer'])],
            'payment_status' => ['nullable', Rule::enum(PaymentStatus::class)],
            'customer_id' => ['nullable', 'integer'],
        ]);

        $groupBy = $data['group_by'] ?? 'day';

        return response()->json([
            'data' => [
                'period' => ['from' => $from, 'to' => $to],
                'group_by' => $groupBy,
            ] + $reports->sales($from, $to, $groupBy, $data['payment_status'] ?? null, $data['customer_id'] ?? null)
        ]);
    }

    public function purchases(Request $request, ReportService $reports): JsonResponse
    {
        [$from, $to, $data] = $this->range($request, [
            'group_by' => ['nullable', Rule::in(['day', 'month', 'supplier'])],
            'status' => ['nullable', Rule::enum(PurchaseOrderStatus::class)],
            'supplier_id' => ['nullable', 'integer'],
        ]);

        $groupBy = $data['group_by'] ?? 'day';
        $status = $data['status'] ?? PurchaseOrderStatus::Received->value;

        return response()->json([
            'data' => [
                'period' => ['from' => $from, 'to' => $to],
                'group_by' => $groupBy,
                'status' => $status,
            ] + $reports->purchases($from, $to, $groupBy, $status, $data['supplier_id'] ?? null)
        ]);
    }

    public function receivables(ReportService $reports): JsonResponse
    {
        return response()->json(['data' => $reports->receivables()]);
    }

    public function expenses(Request $request, ReportService $reports): JsonResponse
    {
        [$from, $to] = $this->range($request);

        return response()->json([
            'data' => [
                'period' => ['from' => $from, 'to' => $to],
            ] + $reports->expenses($from, $to)
        ]);
    }

    public function stockCard(Request $request, ReportService $reports): JsonResponse
    {
        [$from, $to, $data] = $this->range($request, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
        ]);

        $product = Product::withTrashed()->with('unit:id,code')->findOrFail($data['product_id']);
        $warehouse = Warehouse::findOrFail($data['warehouse_id']);

        return response()->json([
            'data' => [
                'product' => [
                    'id' => $product->id,
                    'sku' => $product->sku,
                    'name' => $product->name,
                    'unit' => $product->unit?->code,
                ],
                'warehouse' => ['id' => $warehouse->id, 'code' => $warehouse->code, 'name' => $warehouse->name],
                'period' => ['from' => $from, 'to' => $to],
            ] + $reports->stockCard($product->id, $warehouse->id, $from, $to, $this->perPage($request))
        ]);
    }

    /**
     * Validasi rentang tanggal. Default: awal bulan dari 'to' sampai hari ini.
     *
     * @return array{0: string, 1: string, 2: array}
     */
    private function range(Request $request, array $rules = []): array
    {
        $data = $request->validate($rules + [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $to = $data['to'] ?? now()->toDateString();
        $from = $data['from'] ?? Carbon::parse($to)->startOfMonth()->toDateString();

        return [$from, $to, $data];
    }
}
