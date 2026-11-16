<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UnitRequest;
use App\Http\Resources\UnitResource;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UnitController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $units = Unit::query()
            ->when($request->query('search'), function ($q, $s) {
                $q->where(fn($w) => $w->where('name', 'like', "%{$s}%")
                    ->orWhere('code', 'like', "%{$s}%"));
            })
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return UnitResource::collection($units);
    }

    public function store(UnitRequest $request): JsonResponse
    {
        $unit = Unit::create($request->validated());

        return (new UnitResource($unit))->response()->setStatusCode(201);
    }

    public function show(Unit $unit): UnitResource
    {
        return new UnitResource($unit);
    }

    public function update(UnitRequest $request, Unit $unit): UnitResource
    {
        $unit->update($request->validated());

        return new UnitResource($unit);
    }

    public function destroy(Unit $unit): JsonResponse
    {
        if ($unit->products()->withTrashed()->exists()) {
            return response()->json(['message' => 'Satuan masih dipakai oleh produk.'], 409);
        }

        $unit->delete();

        return response()->json(null, 204);
    }
}
