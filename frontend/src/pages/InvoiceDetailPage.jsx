import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getInvoice } from "../api/invoices";
import Spinner from "../components/Spinner";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import { Info, TotalRow } from "../components/ui/DetailParts";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
} from "../lib/format";
import { isOverdue } from "../lib/invoices";
import {
    INVOICE_STATUS,
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    RECORD_STATUS,
} from "../lib/statuses";

const ITEM_COLUMNS = [
    {
        key: "sku",
        header: "SKU",
        cell: (item) => (
            <span className="font-mono text-xs">{item.product.sku}</span>
        ),
    },
    { key: "name", header: "Produk", cell: (item) => item.product.name },
    {
        key: "quantity",
        header: "Qty",
        align: "right",
        cell: (item) => formatNumber(item.quantity),
    },
    {
        key: "unit_price",
        header: "Harga",
        align: "right",
        cell: (item) => formatCurrency(item.unit_price),
    },
    {
        key: "discount_percent",
        header: "Diskon",
        align: "right",
        cell: (item) =>
            Number(item.discount_percent) > 0
                ? `${formatNumber(item.discount_percent)}%`
                : "-",
    },
    {
        key: "line_total",
        header: "Subtotal",
        align: "right",
        cell: (item) => (
            <span className="whitespace-nowrap font-medium">
                {formatCurrency(item.line_total)}
            </span>
        ),
    },
];

const PAYMENT_COLUMNS = [
    {
        key: "payment_number",
        header: "No. Pembayaran",
        cell: (p) => (
            <span className="font-mono text-xs">{p.payment_number}</span>
        ),
    },
    {
        key: "payment_date",
        header: "Tanggal",
        cell: (p) => formatDate(p.payment_date),
    },
    {
        key: "method",
        header: "Metode",
        cell: (p) => PAYMENT_METHOD[p.method] ?? p.method,
    },
    {
        key: "amount",
        header: "Jumlah",
        align: "right",
        cell: (p) => (
            <span
                className={`whitespace-nowrap font-medium ${p.status === "void" ? "text-slate-400 line-through" : ""}`}>
                {formatCurrency(p.amount)}
            </span>
        ),
    },
    {
        key: "status",
        header: "Status",
        cell: (p) => <StatusBadge map={RECORD_STATUS} status={p.status} />,
    },
];

export default function InvoiceDetailPage() {
    const { id } = useParams();

    const query = useQuery({
        queryKey: ["invoice", id],
        queryFn: () => getInvoice(id),
    });
    const invoice = query.data;

    const back = (
        <Link
            to="/invoices"
            className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke daftar invoice
        </Link>
    );

    if (query.isLoading) {
        return (
            <>
                {back}
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            </>
        );
    }

    if (query.isError) {
        const notFound = query.error?.response?.status === 404;

        return (
            <>
                {back}
                <div className="rounded-xl bg-white p-8 text-center shadow">
                    <p className="text-red-600">
                        {notFound
                            ? "Invoice tidak ditemukan."
                            : getErrorMessage(query.error)}
                    </p>
                    {!notFound && (
                        <button
                            onClick={() => query.refetch()}
                            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                            Coba lagi
                        </button>
                    )}
                </div>
            </>
        );
    }

    const so = invoice.sales_order;
    const isVoid = invoice.status === "void";
    const terms =
        so.payment_terms_days === 0 ? "Tunai" : `${so.payment_terms_days} hari`;

    return (
        <>
            {back}

            <PageHeader
                title={invoice.invoice_number}
                description={`Tanggal invoice ${formatDate(invoice.invoice_date)}`}
                actions={
                    <>
                        {isVoid ? (
                            <StatusBadge map={INVOICE_STATUS} status="void" />
                        ) : (
                            <StatusBadge
                                map={PAYMENT_STATUS}
                                status={invoice.payment_status}
                            />
                        )}
                        <Link
                            to={`/invoices/${invoice.id}/print`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <Printer className="h-4 w-4" /> Cetak
                        </Link>
                    </>
                }
            />

            {isVoid && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    Invoice ini di-void ({formatDateTime(invoice.voided_at)})
                    karena Sales Order-nya dibatalkan. Invoice void tidak bisa
                    menerima pembayaran.
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <dl className="grid gap-4 rounded-xl bg-white p-5 shadow sm:grid-cols-2">
                        <Info label="Customer">
                            {invoice.customer?.name}
                            <span className="block text-xs text-slate-500">
                                {invoice.customer?.code}
                            </span>
                        </Info>
                        <Info label="Sales Order">
                            <Link
                                to={`/sales-orders/${so.id}`}
                                className="font-mono text-xs text-indigo-600 hover:underline">
                                {so.so_number}
                            </Link>
                        </Info>
                        <Info label="Jatuh tempo">
                            {formatDate(invoice.due_date)}
                            {isOverdue(invoice) && (
                                <span className="ml-2">
                                    <Badge tone="red">Telat</Badge>
                                </span>
                            )}
                        </Info>
                        <Info label="Termin pembayaran">{terms}</Info>
                        {invoice.customer?.address && (
                            <div className="sm:col-span-2">
                                <Info label="Alamat">
                                    {invoice.customer.address}
                                </Info>
                            </div>
                        )}
                    </dl>

                    <DataTable
                        columns={ITEM_COLUMNS}
                        rows={so.items ?? []}
                        emptyMessage="Tidak ada item."
                    />

                    <div className="ml-auto w-full max-w-xs space-y-1 rounded-xl bg-white p-4 text-sm shadow">
                        <TotalRow label="Subtotal" value={invoice.subtotal} />
                        <TotalRow label="Pajak" value={invoice.tax_amount} />
                        <TotalRow label="Total" value={invoice.total} strong />
                        <TotalRow label="Dibayar" value={invoice.paid_amount} />
                        <TotalRow
                            label="Sisa tagihan"
                            value={isVoid ? 0 : invoice.outstanding_amount}
                            strong
                        />
                    </div>
                </div>

                <aside className="h-fit space-y-4">
                    <div className="overflow-hidden rounded-xl bg-white shadow">
                        <h2 className="px-5 pb-1 pt-5 text-sm font-semibold text-slate-800">
                            Pembayaran
                        </h2>
                        <DataTable
                            columns={PAYMENT_COLUMNS}
                            rows={invoice.payments ?? []}
                            emptyMessage="Belum ada pembayaran."
                        />
                    </div>
                </aside>
            </div>
        </>
    );
}
