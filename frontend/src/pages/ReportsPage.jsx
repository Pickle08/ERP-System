import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getErrorMessage } from "../api/errors";
import {
    getExpensesReport,
    getPurchasesReport,
    getReceivablesReport,
    getSalesReport,
    getSummaryReport,
} from "../api/reports";
import Spinner from "../components/Spinner";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import { useListParams } from "../hooks/useListParams";
import { formatCurrency, formatDate, todayInJakarta } from "../lib/format";
import {
    EXPENSE_CATEGORY,
    PAYMENT_STATUS,
    PURCHASE_ORDER_STATUS,
} from "../lib/statuses";
import { inputClass } from "../lib/ui";

const TABS = [
    { key: "summary", label: "Ringkasan" },
    { key: "sales", label: "Penjualan" },
    { key: "purchases", label: "Pembelian" },
    { key: "receivables", label: "Piutang" },
    { key: "expenses", label: "Biaya" },
];

const GROUP_LABEL = {
    day: "Tanggal",
    month: "Bulan",
    customer: "Customer",
    supplier: "Supplier",
};

// ---------- tanggal (YYYY-MM-DD, zona WIB) ----------
const monthStart = (date) => `${date.slice(0, 7)}-01`;

function shiftDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);

    return d.toISOString().slice(0, 10);
}

function lastMonth(date) {
    const d = new Date(`${monthStart(date)}T00:00:00Z`);
    d.setUTCDate(0); // hari terakhir bulan sebelumnya
    const end = d.toISOString().slice(0, 10);

    return [monthStart(end), end];
}

const monthFormat = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
});

function formatGroup(groupBy, label) {
    if (groupBy === "day") return formatDate(label);
    if (groupBy === "month")
        return monthFormat.format(new Date(`${label}-01T00:00:00Z`));

    return label;
}

// ---------- kolom dan tabel ----------
const bold = (row) => (row.isTotal ? "font-bold" : "");

const labelCol = (header, render) => ({
    key: "label",
    header,
    cell: (row) => (
        <span className={bold(row)}>{row.isTotal ? "TOTAL" : render(row)}</span>
    ),
});

const countCol = (key, header) => ({
    key,
    header,
    align: "right",
    cell: (row) => <span className={bold(row)}>{row[key]}</span>,
});

const moneyCol = (key, header) => ({
    key,
    header,
    align: "right",
    cell: (row) => (
        <span className={`whitespace-nowrap ${bold(row)}`}>
            {formatCurrency(row[key])}
        </span>
    ),
});

function ReportTable({ query, columns, rows = [], totals, emptyMessage }) {
    const body = rows.map((row, index) => ({ ...row, id: index }));
    if (totals && rows.length > 0)
        body.push({ ...totals, id: "total", isTotal: true });

    return (
        <DataTable
            columns={columns}
            rows={body}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            error={query.error}
            onRetry={() => query.refetch()}
            emptyMessage={emptyMessage}
        />
    );
}

const select = `${inputClass()} bg-white sm:w-48`;

// ---------- tab ----------
function StatCard({ label, value, hint, tone = "text-slate-800" }) {
    return (
        <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className={`mt-1 text-xl font-bold ${tone}`}>
                {formatCurrency(value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
    );
}

function SummaryTab({ range }) {
    const query = useQuery({
        queryKey: ["reports", "summary", range],
        queryFn: () => getSummaryReport(range),
        placeholderData: keepPreviousData,
    });

    if (query.isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        );
    }

    if (query.isError) {
        return (
            <div className="rounded-xl bg-white p-8 text-center shadow">
                <p className="text-red-600">{getErrorMessage(query.error)}</p>
                <button
                    onClick={() => query.refetch()}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    Coba lagi
                </button>
            </div>
        );
    }

    const d = query.data;
    const overdue = Number(d.receivables.overdue);

    return (
        <>
            <div
                className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${query.isFetching ? "opacity-60" : ""}`}>
                <StatCard
                    label="Penjualan"
                    value={d.sales.total}
                    hint={`${d.sales.invoice_count} invoice aktif`}
                />
                <StatCard
                    label="Pembelian"
                    value={d.purchases.total}
                    hint={`${d.purchases.order_count} PO diterima`}
                />
                <StatCard
                    label="Biaya operasional"
                    value={d.expenses.total}
                    hint={`${d.expenses.expense_count} transaksi`}
                />
                <StatCard
                    label="Pembayaran masuk"
                    value={d.payments_received.total}
                    hint={`${d.payments_received.payment_count} pembayaran`}
                />
                <StatCard
                    label="Piutang (posisi hari ini)"
                    value={d.receivables.outstanding}
                    tone={overdue > 0 ? "text-red-600" : "text-slate-800"}
                    hint={`${d.receivables.invoice_count} invoice · telat ${formatCurrency(d.receivables.overdue)}`}
                />
            </div>

            <p className="mt-4 text-xs text-slate-500">
                Penjualan = invoice aktif (void tidak dihitung) per tanggal
                invoice. Pembelian = PO yang sudah diterima per tanggal PO.
                Piutang selalu posisi hari ini, tidak ikut rentang tanggal.
                Belum ada laporan laba/rugi karena costing (HPP) belum dibuat.
            </p>
        </>
    );
}

function SalesTab({ range, get, update }) {
    const groupBy = get("group_by") || "day";
    const paymentStatus = get("payment_status");
    const params = {
        ...range,
        group_by: groupBy,
        payment_status: paymentStatus || undefined,
    };

    const query = useQuery({
        queryKey: ["reports", "sales", params],
        queryFn: () => getSalesReport(params),
        placeholderData: keepPreviousData,
    });

    const columns = [
        labelCol(GROUP_LABEL[groupBy], (row) =>
            formatGroup(groupBy, row.label),
        ),
        countCol("invoice_count", "Invoice"),
        moneyCol("subtotal", "Subtotal"),
        moneyCol("tax_amount", "Pajak"),
        moneyCol("total", "Total"),
    ];

    return (
        <>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                <select
                    value={groupBy}
                    onChange={(e) => update({ group_by: e.target.value })}
                    className={select}>
                    <option value="day">Per hari</option>
                    <option value="month">Per bulan</option>
                    <option value="customer">Per customer</option>
                </select>
                <select
                    value={paymentStatus}
                    onChange={(e) => update({ payment_status: e.target.value })}
                    className={select}>
                    <option value="">Semua pembayaran</option>
                    {Object.entries(PAYMENT_STATUS).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ),
                    )}
                </select>
            </div>
            <ReportTable
                query={query}
                columns={columns}
                rows={query.data?.rows}
                totals={query.data?.totals}
                emptyMessage="Tidak ada penjualan pada periode ini."
            />
        </>
    );
}

function PurchasesTab({ range, get, update }) {
    const groupBy = get("group_by") || "day";
    const status = get("status") || "received";
    const params = { ...range, group_by: groupBy, status };

    const query = useQuery({
        queryKey: ["reports", "purchases", params],
        queryFn: () => getPurchasesReport(params),
        placeholderData: keepPreviousData,
    });

    const columns = [
        labelCol(GROUP_LABEL[groupBy], (row) =>
            formatGroup(groupBy, row.label),
        ),
        countCol("order_count", "PO"),
        moneyCol("subtotal", "Subtotal"),
        moneyCol("tax_amount", "Pajak"),
        moneyCol("total", "Total"),
    ];

    return (
        <>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                <select
                    value={groupBy}
                    onChange={(e) => update({ group_by: e.target.value })}
                    className={select}>
                    <option value="day">Per hari</option>
                    <option value="month">Per bulan</option>
                    <option value="supplier">Per supplier</option>
                </select>
                <select
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                    className={select}>
                    {Object.entries(PURCHASE_ORDER_STATUS).map(
                        ([value, { label }]) => (
                            <option key={value} value={value}>
                                Status: {label}
                            </option>
                        ),
                    )}
                </select>
            </div>
            <ReportTable
                query={query}
                columns={columns}
                rows={query.data?.rows}
                totals={query.data?.totals}
                emptyMessage="Tidak ada PO dengan status ini pada periode ini."
            />
        </>
    );
}

function ReceivablesTab() {
    const query = useQuery({
        queryKey: ["reports", "receivables"],
        queryFn: () => getReceivablesReport(),
    });

    const columns = [
        labelCol("Customer", (row) => row.customer_name),
        countCol("invoice_count", "Invoice"),
        moneyCol("not_due", "Belum jatuh tempo"),
        moneyCol("overdue_1_30", "Telat 1–30 hr"),
        moneyCol("overdue_31_60", "Telat 31–60 hr"),
        moneyCol("overdue_61_90", "Telat 61–90 hr"),
        moneyCol("overdue_over_90", "Telat > 90 hr"),
        moneyCol("outstanding", "Total sisa"),
    ];

    return (
        <>
            {query.data && (
                <p className="mb-3 text-sm text-slate-500">
                    Posisi per {formatDate(query.data.as_of)}. Umur dihitung
                    dari tanggal jatuh tempo invoice aktif yang masih ada sisa
                    tagihan.
                </p>
            )}
            <ReportTable
                query={query}
                columns={columns}
                rows={query.data?.customers}
                totals={query.data?.totals}
                emptyMessage="Tidak ada piutang."
            />
        </>
    );
}

function ExpensesTab({ range }) {
    const query = useQuery({
        queryKey: ["reports", "expenses", range],
        queryFn: () => getExpensesReport(range),
        placeholderData: keepPreviousData,
    });

    const columns = [
        labelCol("Kategori", (row) => EXPENSE_CATEGORY[row.label] ?? row.label),
        countCol("expense_count", "Transaksi"),
        moneyCol("total", "Total"),
    ];

    return (
        <ReportTable
            query={query}
            columns={columns}
            rows={query.data?.rows}
            totals={query.data?.totals}
            emptyMessage="Tidak ada biaya pada periode ini."
        />
    );
}

// ---------- halaman ----------
export default function ReportsPage() {
    const { get, update } = useListParams();
    const today = todayInJakarta();

    const tab = get("tab") || "summary";
    const from = get("from") || shiftDays(today, -29);
    const to = get("to") || today;
    const range = { from, to };

    const presets = [
        { label: "Bulan ini", range: [monthStart(today), today] },
        { label: "Bulan lalu", range: lastMonth(today) },
        { label: "30 hari terakhir", range: [shiftDays(today, -29), today] },
        { label: "90 hari terakhir", range: [shiftDays(today, -89), today] },
    ];

    const switchTab = (key) =>
        update({
            tab: key === "summary" ? "" : key,
            group_by: "",
            payment_status: "",
            status: "",
        });

    return (
        <>
            <PageHeader
                title="Laporan"
                description="Semua angka dijumlahkan dari transaksi tersimpan."
            />

            <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => switchTab(key)}
                        className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
                            tab === key
                                ? "border-indigo-600 text-indigo-600"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}>
                        {label}
                    </button>
                ))}
            </div>

            {tab !== "receivables" && (
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap gap-2">
                        {presets.map((preset) => {
                            const active =
                                preset.range[0] === from &&
                                preset.range[1] === to;

                            return (
                                <button
                                    key={preset.label}
                                    onClick={() =>
                                        update({
                                            from: preset.range[0],
                                            to: preset.range[1],
                                        })
                                    }
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                        active
                                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}>
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        Dari
                        <input
                            type="date"
                            value={from}
                            max={to}
                            onChange={(e) => update({ from: e.target.value })}
                            className={`${inputClass()} bg-white`}
                        />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        Sampai
                        <input
                            type="date"
                            value={to}
                            min={from}
                            onChange={(e) => update({ to: e.target.value })}
                            className={`${inputClass()} bg-white`}
                        />
                    </label>
                </div>
            )}

            {tab === "summary" && <SummaryTab range={range} />}
            {tab === "sales" && (
                <SalesTab range={range} get={get} update={update} />
            )}
            {tab === "purchases" && (
                <PurchasesTab range={range} get={get} update={update} />
            )}
            {tab === "receivables" && <ReceivablesTab />}
            {tab === "expenses" && <ExpensesTab range={range} />}
        </>
    );
}
