import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAllCustomers } from "../api/customers";
import { getSalesOrders } from "../api/salesOrders";
import { SO_WRITE_ROLES } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate } from "../lib/format";
import { SALES_ORDER_STATUS } from "../lib/statuses";
import { inputClass } from "../lib/ui";

const COLUMNS = [
    {
        key: "so_number",
        header: "No. SO",
        cell: (row) => (
            <Link
                to={`/sales-orders/${row.id}`}
                className="font-mono text-xs font-medium text-indigo-600 hover:underline">
                {row.so_number}
            </Link>
        ),
    },
    {
        key: "order_date",
        header: "Tanggal",
        cell: (row) => formatDate(row.order_date),
    },
    {
        key: "customer",
        header: "Customer",
        cell: (row) => row.customer?.name ?? "-",
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
            <StatusBadge map={SALES_ORDER_STATUS} status={row.status} />
        ),
    },
];

export default function SalesOrdersPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);
    const { user } = useAuth();
    const canCreate = SO_WRITE_ROLES.includes(user.role);

    const status = get("status");
    const customerId = get("customer_id");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        status: status || undefined,
        customer_id: customerId || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const orders = useQuery({
        queryKey: ["sales-orders", params],
        queryFn: () => getSalesOrders(params),
        placeholderData: keepPreviousData,
    });

    const customers = useQuery({
        queryKey: ["customers", "all"],
        queryFn: getAllCustomers,
        staleTime: 5 * 60_000,
    });

    const handleReset = () => {
        reset();
        setResetKey((key) => key + 1);
    };

    return (
        <>
            <PageHeader
                title="Penjualan (SO)"
                description="Sales Order ke customer, pengeluaran barang, dan invoice."
                actions={
                    canCreate && (
                        <Link
                            to="/sales-orders/new"
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            + Buat SO
                        </Link>
                    )
                }
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-64">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nomor SO..."
                    />
                </div>

                <select
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-44`}>
                    <option value="">Semua status</option>
                    {Object.entries(SALES_ORDER_STATUS).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ),
                    )}
                </select>

                <select
                    value={customerId}
                    onChange={(e) => update({ customer_id: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-56`}>
                    <option value="">Semua customer</option>
                    {(customers.data ?? []).map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
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
                        ? "Tidak ada SO yang cocok dengan filter."
                        : "Belum ada Sales Order."
                }
            />

            <Pagination
                meta={orders.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />
        </>
    );
}
