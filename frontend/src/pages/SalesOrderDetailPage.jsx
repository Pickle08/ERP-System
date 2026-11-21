import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getSalesOrder } from "../api/salesOrders";
import SalesOrderActionDialog from "../components/sales-orders/SalesOrderActionDialog";
import SalesOrderActions from "../components/sales-orders/SalesOrderActions";
import Spinner from "../components/Spinner";
import DataTable from "../components/ui/DataTable";
import { Info, TotalRow } from "../components/ui/DetailParts";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import StatusTimeline from "../components/ui/StatusTimeline";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
} from "../lib/format";
import {
    INVOICE_STATUS,
    PAYMENT_STATUS,
    SALES_ORDER_STATUS,
} from "../lib/statuses";
import { INVOICE_VIEW_ROLES } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";

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

export default function SalesOrderDetailPage() {
    const { id } = useParams();
    const [action, setAction] = useState(null);

    const { user } = useAuth();
    const canViewInvoice = INVOICE_VIEW_ROLES.includes(user.role);

    const query = useQuery({
        queryKey: ["sales-order", id],
        queryFn: () => getSalesOrder(id),
    });
    const so = query.data;

    const back = (
        <Link
            to="/sales-orders"
            className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke daftar SO
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
                            ? "SO tidak ditemukan."
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

    const terms =
        so.payment_terms_days === 0 ? "Tunai" : `${so.payment_terms_days} hari`;

    return (
        <>
            {back}

            <PageHeader
                title={so.so_number}
                description={`Tanggal SO ${formatDate(so.order_date)}`}
                actions={
                    <>
                        <StatusBadge
                            map={SALES_ORDER_STATUS}
                            status={so.status}
                        />
                        <SalesOrderActions so={so} onAction={setAction} />
                    </>
                }
            />

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <dl className="grid gap-4 rounded-xl bg-white p-5 shadow sm:grid-cols-2">
                        <Info label="Customer">
                            {so.customer?.name}
                            <span className="block text-xs text-slate-500">
                                {so.customer?.code}
                            </span>
                        </Info>
                        <Info label="Gudang asal">{so.warehouse?.name}</Info>
                        <Info label="Termin pembayaran">{terms}</Info>
                        <Info label="Dibuat oleh">
                            {so.created_by
                                ? `${so.created_by.name} · ${formatDateTime(so.created_at)}`
                                : null}
                        </Info>
                        <Info label="Dikonfirmasi oleh">
                            {so.confirmed_by
                                ? `${so.confirmed_by.name} · ${formatDateTime(so.confirmed_at)}`
                                : null}
                        </Info>
                        <Info label="Barang dikeluarkan oleh">
                            {so.issued_by
                                ? `${so.issued_by.name} · ${formatDateTime(so.issued_at)}`
                                : null}
                        </Info>
                        {so.notes && (
                            <div className="sm:col-span-2">
                                <Info label="Catatan">{so.notes}</Info>
                            </div>
                        )}
                    </dl>

                    <DataTable
                        columns={ITEM_COLUMNS}
                        rows={so.items}
                        emptyMessage="SO ini belum punya item."
                    />

                    <div className="ml-auto w-full max-w-xs space-y-1 rounded-xl bg-white p-4 text-sm shadow">
                        <TotalRow label="Subtotal" value={so.subtotal} />
                        <TotalRow label="Pajak" value={so.tax_amount} />
                        <TotalRow label="Total" value={so.total} strong />
                    </div>
                </div>

                <aside className="space-y-4">
                    {so.invoice && (
                        <div className="rounded-xl bg-white p-5 shadow">
                            <h2 className="mb-3 text-sm font-semibold text-slate-800">
                                Invoice
                            </h2>
                            {canViewInvoice ? (
                                <Link
                                    to={`/invoices/${so.invoice.id}`}
                                    className="font-mono text-sm font-medium text-indigo-600 hover:underline">
                                    {so.invoice.invoice_number}
                                </Link>
                            ) : (
                                <p className="font-mono text-sm font-medium text-slate-800">
                                    {so.invoice.invoice_number}
                                </p>
                            )}
                            <p className="mt-1 text-sm text-slate-600">
                                {formatCurrency(so.invoice.total)}
                            </p>
                            <div className="mt-2 flex gap-2">
                                <StatusBadge
                                    map={PAYMENT_STATUS}
                                    status={so.invoice.payment_status}
                                />
                                {so.invoice.status === "void" && (
                                    <StatusBadge
                                        map={INVOICE_STATUS}
                                        status="void"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl bg-white p-5 shadow">
                        <h2 className="mb-4 text-sm font-semibold text-slate-800">
                            Histori status
                        </h2>
                        <StatusTimeline
                            histories={so.status_histories}
                            map={SALES_ORDER_STATUS}
                        />
                    </div>
                </aside>
            </div>

            {action && (
                <SalesOrderActionDialog
                    action={action}
                    so={so}
                    onClose={() => setAction(null)}
                />
            )}
        </>
    );
}
