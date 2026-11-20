import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAllCategories } from "../api/categories";
import { getStocks } from "../api/stocks";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import { useListParams } from "../hooks/useListParams";
import { formatNumber } from "../lib/format";
import { Link } from "react-router-dom";
import { STOCK_MOVE_ROLES } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import StockMovementDialog from "../components/stock/StockMovementDialog";

// Label tampilan saja; angka dan filter "menipis" berasal dari backend
function stockStatus(row) {
    const quantity = Number(row.quantity);

    if (quantity <= 0) return { label: "Habis", tone: "red" };
    if (quantity <= Number(row.min_stock))
        return { label: "Menipis", tone: "amber" };

    return { label: "Aman", tone: "green" };
}

const BASE_COLUMNS = [
    {
        key: "sku",
        header: "SKU",
        cell: (row) => <span className="font-mono text-xs">{row.sku}</span>,
    },
    {
        key: "name",
        header: "Nama Produk",
        cell: (row) => (
            <span>
                {row.name}
                {!row.is_active && (
                    <span className="ml-2 text-xs text-slate-400">
                        (nonaktif)
                    </span>
                )}
            </span>
        ),
    },
    { key: "unit", header: "Satuan", cell: (row) => row.unit ?? "-" },
    {
        key: "quantity",
        header: "Stok",
        align: "right",
        cell: (row) => (
            <span className="font-semibold">{formatNumber(row.quantity)}</span>
        ),
    },
    {
        key: "min_stock",
        header: "Minimum",
        align: "right",
        cell: (row) => formatNumber(row.min_stock),
    },
    {
        key: "status",
        header: "Status",
        cell: (row) => {
            const { label, tone } = stockStatus(row);

            return <Badge tone={tone}>{label}</Badge>;
        },
    },
];

export default function StocksPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const { user } = useAuth();
    const canMove = STOCK_MOVE_ROLES.includes(user.role);
    const [dialog, setDialog] = useState(null); // { mode: 'in' | 'out', product: baris stok }

    const columns = [
        ...BASE_COLUMNS,
        {
            key: "actions",
            header: "",
            align: "right",
            cell: (row) => (
                <div className="flex items-center justify-end gap-3 whitespace-nowrap text-xs">
                    {canMove && (
                        <>
                            <button
                                onClick={() =>
                                    setDialog({ mode: "in", product: row })
                                }
                                className="font-medium text-emerald-700 hover:underline">
                                + Masuk
                            </button>
                            <button
                                onClick={() =>
                                    setDialog({ mode: "out", product: row })
                                }
                                className="font-medium text-amber-700 hover:underline">
                                − Keluar
                            </button>
                        </>
                    )}
                    <Link
                        to={`/stocks/${row.product_id}/movements`}
                        className="font-medium text-indigo-600 hover:underline">
                        Riwayat
                    </Link>
                </div>
            ),
        },
    ];
    const [resetKey, setResetKey] = useState(0); // remount SearchInput saat filter di-reset

    const categoryId = get("category_id");
    const lowStock = get("low_stock") === "1";

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        category_id: categoryId || undefined,
        low_stock: lowStock ? 1 : undefined,
    };

    const stocks = useQuery({
        queryKey: ["stocks", params],
        queryFn: () => getStocks(params),
        placeholderData: keepPreviousData, // data lama tetap tampil saat pindah halaman
    });

    const categories = useQuery({
        queryKey: ["categories", "all"],
        queryFn: getAllCategories,
        staleTime: 5 * 60_000,
    });

    const handleReset = () => {
        reset();
        setResetKey((key) => key + 1);
    };

    return (
        <>
            <PageHeader
                title="Stok Produk"
                description="Posisi stok saat ini per produk (semua gudang)."
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-72">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nama atau SKU..."
                    />
                </div>

                <select
                    value={categoryId}
                    onChange={(e) => update({ category_id: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Semua kategori</option>
                    {(categories.data ?? []).map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={lowStock}
                        onChange={(e) =>
                            update({ low_stock: e.target.checked ? "1" : "" })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Stok menipis saja
                </label>

                {hasFilters && (
                    <button
                        onClick={handleReset}
                        className="text-sm text-indigo-600 hover:underline">
                        Reset filter
                    </button>
                )}
            </div>

            <DataTable
                columns={columns}
                rows={stocks.data?.data ?? []}
                rowKey="product_id"
                isLoading={stocks.isLoading}
                isFetching={stocks.isFetching}
                error={stocks.error}
                onRetry={() => stocks.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada produk yang cocok dengan filter."
                        : "Belum ada produk."
                }
            />

            <Pagination
                meta={stocks.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />
            {dialog && (
                <StockMovementDialog
                    mode={dialog.mode}
                    product={dialog.product}
                    onClose={() => setDialog(null)}
                />
            )}
        </>
    );
}
