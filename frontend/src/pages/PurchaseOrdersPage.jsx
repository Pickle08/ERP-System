import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPurchaseOrders } from "../api/purchaseOrders";
import { getAllSuppliers } from "../api/suppliers";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate } from "../lib/format";
import { PURCHASE_ORDER_STATUS } from "../lib/statuses";
import { inputClass } from "../lib/ui";

const COLUMNS = [
    {
        key: "po_number",
        header: "No. PO",
        cell: (row) => (
            <Link
                to={`/purchase-orders/${row.id}`}
                className="font-mono text-xs font-medium text-indigo-600 hover:underline">
                {row.po_number}
            </Link>
        ),
    },
    {
        key: "order_date",
        header: "Tanggal",
        cell: (row) => formatDate(row.order_date),
    },
    {
        key: "supplier",
        header: "Supplier",
        cell: (row) => row.supplier?.name ?? "-",
    },
    {
        key: "items_count",
        header: "Item",
        align: "right",
        cell: (row) => row.items_count,
    },
    {
        key: "total",
        header: "Total",
        align: "right",
        cell: (row) => (
            <span className="whitespace-nowrap font-medium">
                {formatCurrency(row.total)}
            </span>
        ),
    },
    {
        key: "status",
        header: "Status",
        cell: (row) => (
            <StatusBadge map={PURCHASE_ORDER_STATUS} status={row.status} />
        ),
    },
];

export default function PurchaseOrdersPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);

    const status = get("status");
    const supplierId = get("supplier_id");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        status: status || undefined,
        supplier_id: supplierId || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const orders = useQuery({
        queryKey: ["purchase-orders", params],
        queryFn: () => getPurchaseOrders(params),
        placeholderData: keepPreviousData,
    });

    const suppliers = useQuery({
        queryKey: ["suppliers", "all"],
        queryFn: getAllSuppliers,
        staleTime: 5 * 60_000,
    });

    const handleReset = () => {
        reset();
        setResetKey((key) => key + 1);
    };

    return (
        <>
            <PageHeader
                title="Pembelian (PO)"
                description="Purchase Order ke supplier dan penerimaan barang."
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-64">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nomor PO..."
                    />
                </div>

                <select
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-44`}>
                    <option value="">Semua status</option>
                    {Object.entries(PURCHASE_ORDER_STATUS).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ),
                    )}
                </select>

                <select
                    value={supplierId}
                    onChange={(e) => update({ supplier_id: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-56`}>
                    <option value="">Semua supplier</option>
                    {(suppliers.data ?? []).map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                        </option>
                    ))}
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
                        onClick={handleReset}
                        className="text-sm text-indigo-600 hover:underline">
                        Reset filter
                    </button>
                )}
            </div>

            <DataTable
                columns={COLUMNS}
                rows={orders.data?.data ?? []}
                isLoading={orders.isLoading}
                isFetching={orders.isFetching}
                error={orders.error}
                onRetry={() => orders.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada PO yang cocok dengan filter."
                        : "Belum ada Purchase Order."
                }
            />

            <Pagination
                meta={orders.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />
        </>
    );
}
