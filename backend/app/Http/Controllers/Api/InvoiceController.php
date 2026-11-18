<?php

namespace App\Http\Controllers\Api;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'payment_status' => ['nullable', Rule::enum(PaymentStatus::class)],
            'status' => ['nullable', Rule::enum(InvoiceStatus::class)],
            'customer_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $invoices = Invoice::query()
            ->with(['customer:id,code,name,address', 'salesOrder:id,so_number,order_date,payment_terms_days,notes'])
            ->when($request->query('search'), fn($q, $s) => $q->where('invoice_number', 'like', "%{$s}%"))
            ->when($filters['payment_status'] ?? null, fn($q, $v) => $q->where('payment_status', $v))
            ->when($filters['status'] ?? null, fn($q, $v) => $q->where('status', $v))
            ->when($filters['customer_id'] ?? null, fn($q, $v) => $q->where('customer_id', $v))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('invoice_date', '>=', $d))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('invoice_date', '<=', $d))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return InvoiceResource::collection($invoices);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        return new InvoiceResource(
            $invoice->load(['customer', 'salesOrder.items.product:id,sku,name', 'payments'])
        );
    }
}
