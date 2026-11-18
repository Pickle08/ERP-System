<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Enums\RecordStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\RecordPaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    private const DETAIL = ['invoice.customer:id,name', 'creator:id,name', 'voider:id,name'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'invoice_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::enum(RecordStatus::class)],
            'method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $payments = Payment::query()
            ->with(self::DETAIL)
            ->when($request->query('search'), fn($q, $s) => $q->where('payment_number', 'like', "%{$s}%"))
            ->when($filters['invoice_id'] ?? null, fn($q, $v) => $q->where('invoice_id', $v))
            ->when($filters['status'] ?? null, fn($q, $v) => $q->where('status', $v))
            ->when($filters['method'] ?? null, fn($q, $v) => $q->where('method', $v))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('payment_date', '>=', $d))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('payment_date', '<=', $d))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return PaymentResource::collection($payments);
    }

    public function show(Payment $payment): PaymentResource
    {
        return new PaymentResource($payment->load(self::DETAIL));
    }

    public function store(RecordPaymentRequest $request, Invoice $invoice, PaymentService $service): JsonResponse
    {
        $payment = $service->record($invoice, $request->validated(), $request->user());

        return (new PaymentResource($payment->load(self::DETAIL)))->response()->setStatusCode(201);
    }

    public function void(Request $request, Payment $payment, PaymentService $service): PaymentResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        return new PaymentResource(
            $service->void($payment, $request->user(), $data['reason'])->load(self::DETAIL)
        );
    }
}
