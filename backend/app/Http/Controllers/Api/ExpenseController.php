<?php

namespace App\Http\Controllers\Api;

use App\Enums\ExpenseCategory;
use App\Enums\RecordStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    private const DETAIL = ['creator:id,name', 'voider:id,name'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'category' => ['nullable', Rule::enum(ExpenseCategory::class)],
            'status' => ['nullable', Rule::enum(RecordStatus::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $expenses = Expense::query()
            ->with(self::DETAIL)
            ->when($request->query('search'), function ($q, $s) {
                $q->where(fn($w) => $w->where('expense_number', 'like', "%{$s}%")
                    ->orWhere('description', 'like', "%{$s}%"));
            })
            ->when($filters['category'] ?? null, fn($q, $v) => $q->where('category', $v))
            ->when($filters['status'] ?? null, fn($q, $v) => $q->where('status', $v))
            ->when($filters['from'] ?? null, fn($q, $d) => $q->where('expense_date', '>=', $d))
            ->when($filters['to'] ?? null, fn($q, $d) => $q->where('expense_date', '<=', $d))
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ExpenseResource::collection($expenses);
    }

    public function show(Expense $expense): ExpenseResource
    {
        return new ExpenseResource($expense->load(self::DETAIL));
    }

    public function store(ExpenseRequest $request, ExpenseService $service): JsonResponse
    {
        $expense = $service->create($request->validated(), $request->user());

        return (new ExpenseResource($expense->load(self::DETAIL)))->response()->setStatusCode(201);
    }

    public function void(Request $request, Expense $expense, ExpenseService $service): ExpenseResource
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']]);

        return new ExpenseResource(
            $service->void($expense, $request->user(), $data['reason'])->load(self::DETAIL)
        );
    }
}
