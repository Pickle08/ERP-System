import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getProduct } from "../api/products";
import { getMovements } from "../api/stocks";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import { useListParams } from "../hooks/useListParams";
import { formatDateTime, formatNumber } from "../lib/format";
import { STOCK_MOVEMENT_TYPES } from "../lib/stockTypes";
import { inputClass } from "../lib/ui";

const COLUMNS = [
    {
        key: "created_at",
        header: "Waktu",
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatDateTime(row.created_at)}
            </span>
        ),
    },
    {
        key: "type",
        header: "Tipe",
        cell: (row) => {
            const type = STOCK_MOVEMENT_TYPES[row.type] ?? {
                label: row.type,
                tone: "slate",
            };

            return <Badge tone={type.tone}>{type.label}</Badge>;
        },
    },
    {
        key: "quantity",
        header: "Jumlah",
        align: "right",
        cell: (row) => {
            const quantity = Number(row.quantity);

            return (
                <span
                    className={`font-semibold ${quantity > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {quantity > 0 ? "+" : ""}
                    {formatNumber(quantity)}
                </span>
            );
        },
    },
    {
        key: "balance_after",
        header: "Saldo",
        align: "right",
        cell: (row) => formatNumber(row.balance_after),
    },
    {
        key: "reference_number",
        header: "Referensi",
        cell: (row) => row.reference_number ?? "-",
    },
    { key: "reason", header: "Alasan", cell: (row) => row.reason },
    {
        key: "created_by",
        header: "Oleh",
        cell: (row) => row.created_by?.name ?? "-",
    },
];

export default function StockMovementsPage() {
    const { productId } = useParams();
    const { page, get, update, reset, hasFilters } = useListParams();

    const type = get("type");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const product = useQuery({
        queryKey: ["product", productId],
        queryFn: () => getProduct(productId),
    });

    const movements = useQuery({
        queryKey: ["movements", productId, params],
        queryFn: () => getMovements(productId, params),
        placeholderData: keepPreviousData,
    });

    return (
        <>
            <Link
                to="/stocks"
                className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Kembali ke Stok Produk
            </Link>

            <PageHeader
                title={
                    product.data ? product.data.name : "Riwayat Pergerakan Stok"
                }
                description={
                    product.data
                        ? `${product.data.sku} · Riwayat pergerakan stok`
                        : product.isError
                          ? getErrorMessage(product.error)
                          : "Memuat produk..."
                }
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <select
                    value={type}
                    onChange={(e) => update({ type: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-48`}>
                    <option value="">Semua tipe</option>
                    {Object.entries(STOCK_MOVEMENT_TYPES).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ),
                    )}
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    Dari
                    <input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => update({ from: e.target.value })}
                        className={`${inputClass()} bg-white`}
                    />
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    Sampai
                    <input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => update({ to: e.target.value })}
                        className={`${inputClass()} bg-white`}
                    />
                </label>

                {hasFilters && (
                    <button
                        onClick={reset}
                        className="text-sm text-indigo-600 hover:underline">
                        Reset filter
                    </button>
                )}
            </div>

            <DataTable
                columns={COLUMNS}
                rows={movements.data?.data ?? []}
                isLoading={movements.isLoading}
                isFetching={movements.isFetching}
                error={movements.error}
                onRetry={() => movements.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada pergerakan yang cocok dengan filter."
                        : "Belum ada pergerakan stok."
                }
            />

            <Pagination
                meta={movements.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />
        </>
    );
}
