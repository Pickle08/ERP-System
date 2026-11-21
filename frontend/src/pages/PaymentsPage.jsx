import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPayments } from "../api/payments";
import { FINANCE_WRITE_ROLES } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import PaymentVoidDialog from "../components/finance/PaymentVoidDialog";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate } from "../lib/format";
import { PAYMENT_METHOD, RECORD_STATUS } from "../lib/statuses";
import { inputClass } from "../lib/ui";

const BASE_COLUMNS = [
    {
        key: "payment_number",
        header: "No. Pembayaran",
        cell: (row) => (
            <span className="font-mono text-xs">{row.payment_number}</span>
        ),
    },
    {
        key: "payment_date",
        header: "Tanggal",
        cell: (row) => formatDate(row.payment_date),
    },
    {
        key: "invoice",
        header: "Invoice",
        cell: (row) =>
            row.invoice ? (
                <Link
                    to={`/invoices/${row.invoice.id}`}
                    className="font-mono text-xs text-indigo-600 hover:underline">
                    {row.invoice.invoice_number}
                </Link>
            ) : (
                "-"
            ),
    },
    {
        key: "customer",
        header: "Customer",
        cell: (row) => row.invoice?.customer?.name ?? "-",
    },
    {
        key: "method",
        header: "Metode",
        cell: (row) => PAYMENT_METHOD[row.method] ?? row.method,
    },
    {
        key: "amount",
        header: "Jumlah",
        align: "right",
        cell: (row) => (
            <span
                className={`whitespace-nowrap font-medium ${row.status === "void" ? "text-slate-400 line-through" : ""}`}>
                {formatCurrency(row.amount)}
            </span>
        ),
    },
    {
        key: "status",
        header: "Status",
        cell: (row) => (
            <span title={row.void_reason ?? undefined}>
                <StatusBadge map={RECORD_STATUS} status={row.status} />
            </span>
        ),
    },
    {
        key: "created_by",
        header: "Dicatat oleh",
        cell: (row) => row.created_by?.name ?? "-",
    },
];

export default function PaymentsPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);
    const [voiding, setVoiding] = useState(null);
    const { user } = useAuth();
    const canWrite = FINANCE_WRITE_ROLES.includes(user.role);

    const status = get("status");
    const method = get("method");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        status: status || undefined,
        method: method || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const payments = useQuery({
        queryKey: ["payments", params],
        queryFn: () => getPayments(params),
        placeholderData: keepPreviousData,
    });

    const columns = [
        ...BASE_COLUMNS,
        ...(canWrite
            ? [
                  {
                      key: "actions",
                      header: "",
                      align: "right",
                      cell: (row) =>
                          row.status === "active" ? (
                              <button
                                  onClick={() => setVoiding(row)}
                                  className="text-xs font-medium text-red-600 hover:underline">
                                  Void
                              </button>
                          ) : null,
                  },
              ]
            : []),
    ];

    const handleReset = () => {
        reset();
        setResetKey((key) => key + 1);
    };

    return (
        <>
            <PageHeader
                title="Pembayaran"
                description="Pembayaran customer atas invoice. Pencatatan dilakukan dari halaman detail invoice."
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-64">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nomor pembayaran..."
                    />
                </div>

                <select
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-40`}>
                    <option value="">Semua status</option>
                    {Object.entries(RECORD_STATUS).map(([value, { label }]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>

                <select
                    value={method}
                    onChange={(e) => update({ method: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-44`}>
                    <option value="">Semua metode</option>
                    {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
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
                columns={columns}
                rows={payments.data?.data ?? []}
                isLoading={payments.isLoading}
                isFetching={payments.isFetching}
                error={payments.error}
                onRetry={() => payments.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada pembayaran yang cocok dengan filter."
                        : "Belum ada pembayaran."
                }
            />

            <Pagination
                meta={payments.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />

            {voiding && (
                <PaymentVoidDialog
                    payment={voiding}
                    onClose={() => setVoiding(null)}
                />
            )}
        </>
    );
}
