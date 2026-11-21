import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getExpenses } from "../api/expenses";
import { FINANCE_WRITE_ROLES } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import ExpenseFormDialog from "../components/finance/ExpenseFormDialog";
import ExpenseVoidDialog from "../components/finance/ExpenseVoidDialog";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import StatusBadge from "../components/ui/StatusBadge";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate } from "../lib/format";
import { EXPENSE_CATEGORY, RECORD_STATUS } from "../lib/statuses";
import { inputClass } from "../lib/ui";

const BASE_COLUMNS = [
    {
        key: "expense_number",
        header: "No. Biaya",
        cell: (row) => (
            <span className="font-mono text-xs">{row.expense_number}</span>
        ),
    },
    {
        key: "expense_date",
        header: "Tanggal",
        cell: (row) => formatDate(row.expense_date),
    },
    {
        key: "category",
        header: "Kategori",
        cell: (row) => EXPENSE_CATEGORY[row.category] ?? row.category,
    },
    { key: "description", header: "Deskripsi", cell: (row) => row.description },
    {
        key: "reference_number",
        header: "Referensi",
        cell: (row) => row.reference_number ?? "-",
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

export default function ExpensesPage() {
    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);
    const [creating, setCreating] = useState(false);
    const [voiding, setVoiding] = useState(null);
    const { user } = useAuth();
    const canWrite = FINANCE_WRITE_ROLES.includes(user.role);

    const category = get("category");
    const status = get("status");
    const from = get("from");
    const to = get("to");

    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        category: category || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const expenses = useQuery({
        queryKey: ["expenses", params],
        queryFn: () => getExpenses(params),
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
                title="Biaya Operasional"
                description="Biaya di luar pembelian barang: gaji, sewa, listrik, transport, dan lainnya."
                actions={
                    canWrite && (
                        <button
                            onClick={() => setCreating(true)}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            + Catat Biaya
                        </button>
                    )
                }
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-64">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder="Cari nomor atau deskripsi..."
                    />
                </div>

                <select
                    value={category}
                    onChange={(e) => update({ category: e.target.value })}
                    className={`${inputClass()} bg-white sm:w-56`}>
                    <option value="">Semua kategori</option>
                    {Object.entries(EXPENSE_CATEGORY).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>

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
                rows={expenses.data?.data ?? []}
                isLoading={expenses.isLoading}
                isFetching={expenses.isFetching}
                error={expenses.error}
                onRetry={() => expenses.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada biaya yang cocok dengan filter."
                        : "Belum ada biaya yang dicatat."
                }
            />

            <Pagination
                meta={expenses.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />

            {creating && (
                <ExpenseFormDialog onClose={() => setCreating(false)} />
            )}
            {voiding && (
                <ExpenseVoidDialog
                    expense={voiding}
                    onClose={() => setVoiding(null)}
                />
            )}
        </>
    );
}
