import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAllCustomers } from "../api/customers";
import { getInvoices } from "../api/invoices";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate } from "../lib/format";
import { isOverdue } from "../lib/invoices";
import { INVOICE_STATUS, PAYMENT_STATUS } from "../lib/statuses";
import { inputClass } from "../lib/ui";

const COLUMNS = [
    {
        key: "invoice_number",
        header: "No. Invoice",
        cell: (row) => (
            <Link
                to={`/invoices/${row.id}`}
                className="font-mono text-xs font-medium text-indigo-600 hover:underline">
                {row.invoice_number}
            </Link>
        ),
    },
    {
        key: "invoice_date",
        header: "Tanggal",
        cell: (row) => formatDate(row.invoice_date),
    },
    {
        key: "customer",
        header: "Customer",
        cell: (row) => row.customer?.name ?? "-",
    },
    {
        key: "due_date",
        header: "Jatuh tempo",
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatDate(row.due_date)}
                {isOverdue(row) && (
                    <span className="ml-2">
                        <Badge tone="red">Telat</Badge>
                    </span>
                )}
            </span>
        ),
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
        key: "outstanding_amount",
        header: "Sisa tagihan",
        align: "right",
        cell: (row) => (
            <span className="whitespace-nowrap">
                {row.status === "void"
                    ? "-"
                    : formatCurrency(row.outstanding_amount)}
            </span>
        ),
    },
    {
        key: "status",
        header: "Status",
        cell: (row) =>
            row.status === "void" ? (
                <StatusBadge map={INVOICE_STATUS} status="void" />
            ) : (
                <StatusBadge map={PAYMENT_STATUS} status={row.payment_status} />
            ),
    },
];

export default function InvoicesPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);

    const paymentStatus = get("payment_status");
    const status = get("status");
    const customerId = get("customer_id");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        payment_status: paymentStatus || undefined,
        status: status || undefined,
        customer_id: customerId || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const invoices = useQuery({
        queryKey: ["invoices", params],
        queryFn: () => getInvoices(params),
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
                title="Invoice"
                description="Tagihan ke customer. Dibuat otomatis saat barang keluar."
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-64">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nomor invoice..."
                    />
                </div>

                <select
                    value={paymentStatus}
                    onChange={(e) => update({ payment_status: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-44`}>
                    <option value="">Semua pembayaran</option>
                    {Object.entries(PAYMENT_STATUS).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ),
                    )}
                </select>

                <select
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-40`}>
                    <option value="">Aktif dan void</option>
                    {Object.entries(INVOICE_STATUS).map(
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
                rows={invoices.data?.data ?? []}
                isLoading={invoices.isLoading}
                isFetching={invoices.isFetching}
                error={invoices.error}
                onRetry={() => invoices.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada invoice yang cocok dengan filter."
                        : "Belum ada invoice."
                }
            />

            <Pagination
                meta={invoices.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />
        </>
    );
}
