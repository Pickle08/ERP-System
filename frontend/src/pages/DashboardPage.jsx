import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getInvoices } from "../api/invoices";
import { getPurchaseOrders } from "../api/purchaseOrders";
import { getSalesReport, getSummaryReport } from "../api/reports";
import { getSalesOrders } from "../api/salesOrders";
import { getStocks } from "../api/stocks";
import { REPORT_VIEW_ROLES } from "../auth/permissions";
import { ROLE_LABELS } from "../auth/roles";
import { useAuth } from "../auth/useAuth";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import { shiftDays } from "../lib/dates";
import {
    formatCurrency,
    formatDate,
    formatNumber,
    todayInJakarta,
} from "../lib/format";

// Antrian kerja: jumlah dokumen yang menunggu tindakan, dari endpoint daftar (meta.total)
const QUEUES = [
    {
        label: "SO menunggu konfirmasi",
        path: "/sales-orders",
        key: "sales-orders",
        fetch: getSalesOrders,
        filter: { status: "draft" },
        roles: ["admin", "sales"],
    },
    {
        label: "SO siap dikeluarkan barangnya",
        path: "/sales-orders",
        key: "sales-orders",
        fetch: getSalesOrders,
        filter: { status: "confirmed" },
        roles: ["admin", "sales", "warehouse"],
    },
    {
        label: "PO menunggu persetujuan",
        path: "/purchase-orders",
        key: "purchase-orders",
        fetch: getPurchaseOrders,
        filter: { status: "draft" },
        roles: ["admin", "procurement", "owner"],
    },
    {
        label: "PO menunggu penerimaan barang",
        path: "/purchase-orders",
        key: "purchase-orders",
        fetch: getPurchaseOrders,
        filter: { status: "approved" },
        roles: ["admin", "procurement", "warehouse"],
    },
    {
        label: "Invoice belum dibayar",
        path: "/invoices",
        key: "invoices",
        fetch: getInvoices,
        filter: { status: "active", payment_status: "unpaid" },
        roles: ["admin", "finance", "sales", "owner"],
    },
];

function QueueCard({ item }) {
    const params = { ...item.filter, per_page: 1 };
    // key sama dengan halaman daftarnya, jadi ikut ter-refresh saat ada transaksi
    const query = useQuery({
        queryKey: [item.key, params],
        queryFn: () => item.fetch(params),
    });
    const total = query.data?.meta?.total;

    return (
        <Link
            to={`${item.path}?${new URLSearchParams(item.filter)}`}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow hover:bg-slate-50">
            <span className="text-sm text-slate-700">{item.label}</span>
            <span
                className={`text-xl font-bold ${total > 0 ? "text-indigo-600" : "text-slate-300"}`}>
                {query.isError ? "!" : (total ?? "…")}
            </span>
        </Link>
    );
}

function LowStock() {
    const query = useQuery({
        queryKey: ["stocks", { low_stock: 1, per_page: 5 }],
        queryFn: () => getStocks({ low_stock: 1, per_page: 5 }),
    });
    const rows = query.data?.data ?? [];
    const total = query.data?.meta?.total ?? 0;

    return (
        <div className="rounded-xl bg-white p-5 shadow">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                    Stok menipis
                </h2>
                {total > 0 && (
                    <Link
                        to="/stocks?low_stock=1"
                        className="text-xs text-indigo-600 hover:underline">
                        Lihat semua ({total})
                    </Link>
                )}
            </div>

            {query.isLoading && (
                <p className="text-sm text-slate-400">Memuat...</p>
            )}
            {query.isError && (
                <p className="text-sm text-red-600">Gagal memuat data stok.</p>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
                <p className="text-sm text-slate-500">
                    Semua stok di atas minimum.
                </p>
            )}

            <ul className="divide-y divide-slate-100">
                {rows.map((row) => (
                    <li
                        key={row.product_id}
                        className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                                {row.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                {row.sku} · stok {formatNumber(row.quantity)} /
                                min {formatNumber(row.min_stock)} {row.unit}
                            </p>
                        </div>
                        <Badge
                            tone={Number(row.quantity) <= 0 ? "red" : "amber"}>
                            {Number(row.quantity) <= 0 ? "Habis" : "Menipis"}
                        </Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function StatCard({ label, value, hint, tone = "text-slate-800" }) {
    return (
        <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className={`mt-1 text-xl font-bold ${tone}`}>
                {value === undefined ? "…" : formatCurrency(value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{hint ?? " "}</p>
        </div>
    );
}

// Hari tanpa penjualan diisi nol supaya sumbu tanggal jujur
function fillDays(rows, from, to) {
    const byDay = Object.fromEntries(
        rows.map((row) => [row.label, Number(row.total)]),
    );
    const days = [];

    for (let date = from; date <= to; date = shiftDays(date, 1)) {
        days.push({ label: date, value: byDay[date] ?? 0 });
    }

    return days;
}

function ReportSection() {
    const to = todayInJakarta();
    const from = shiftDays(to, -29);
    const range = { from, to };

    // key sama dengan halaman Laporan, jadi cache-nya dipakai bersama
    const summary = useQuery({
        queryKey: ["reports", "summary", range],
        queryFn: () => getSummaryReport(range),
    });
    const sales = useQuery({
        queryKey: ["reports", "sales", { ...range, group_by: "day" }],
        queryFn: () => getSalesReport({ ...range, group_by: "day" }),
    });

    const d = summary.data;
    const overdue = Number(d?.receivables.overdue ?? 0);

    const days = fillDays(sales.data?.rows ?? [], from, to);
    const max = Math.max(...days.map((day) => day.value), 1); // hanya untuk tinggi batang; angka tetap dari server

    return (
        <section className="mb-6 space-y-4">
            <p className="text-xs text-slate-500">
                30 hari terakhir ({formatDate(from)} – {formatDate(to)})
            </p>

            {summary.isError && (
                <p className="text-sm text-red-600">Gagal memuat ringkasan.</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    label="Penjualan"
                    value={d?.sales.total}
                    hint={d && `${d.sales.invoice_count} invoice`}
                />
                <StatCard
                    label="Pembelian"
                    value={d?.purchases.total}
                    hint={d && `${d.purchases.order_count} PO diterima`}
                />
                <StatCard
                    label="Biaya"
                    value={d?.expenses.total}
                    hint={d && `${d.expenses.expense_count} transaksi`}
                />
                <StatCard
                    label="Pembayaran masuk"
                    value={d?.payments_received.total}
                    hint={
                        d && `${d.payments_received.payment_count} pembayaran`
                    }
                />
                <StatCard
                    label="Piutang hari ini"
                    value={d?.receivables.outstanding}
                    tone={overdue > 0 ? "text-red-600" : "text-slate-800"}
                    hint={d && `telat ${formatCurrency(overdue)}`}
                />
            </div>

            <div className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">
                    Penjualan harian
                </h2>

                {sales.isError ? (
                    <p className="text-sm text-red-600">Gagal memuat grafik.</p>
                ) : sales.isLoading ? (
                    <p className="text-sm text-slate-400">Memuat...</p>
                ) : (
                    <>
                        <div className="flex h-40 items-end gap-0.5">
                            {days.map((day) => (
                                <div
                                    key={day.label}
                                    title={`${formatDate(day.label)}: ${formatCurrency(day.value)}`}
                                    className="flex-1 rounded-t bg-indigo-500/80 hover:bg-indigo-600"
                                    style={{
                                        height: `${day.value > 0 ? Math.max((day.value / max) * 100, 2) : 0}%`,
                                    }}
                                />
                            ))}
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-slate-400">
                            <span>{formatDate(from)}</span>
                            <span>{formatDate(to)}</span>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const canSeeReports = REPORT_VIEW_ROLES.includes(user.role);
    const queues = QUEUES.filter((item) => item.roles.includes(user.role));

    return (
        <>
            <PageHeader
                title={`Halo, ${user.name}`}
                description={`Masuk sebagai ${ROLE_LABELS[user.role] ?? user.role}.`}
            />

            {canSeeReports && <ReportSection />}

            <div className="grid gap-4 lg:grid-cols-3">
                {queues.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-semibold text-slate-800">
                            Perlu ditindaklanjuti
                        </h2>
                        {queues.map((item) => (
                            <QueueCard key={`${item.label}`} item={item} />
                        ))}
                    </section>
                )}

                <div
                    className={
                        queues.length > 0 ? "lg:col-span-2" : "lg:col-span-3"
                    }>
                    <LowStock />
                </div>
            </div>
        </>
    );
}
