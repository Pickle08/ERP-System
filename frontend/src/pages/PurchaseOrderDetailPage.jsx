import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getPurchaseOrder } from "../api/purchaseOrders";
import PurchaseOrderActionDialog from "../components/purchase-orders/PurchaseOrderActionDialog";
import PurchaseOrderActions from "../components/purchase-orders/PurchaseOrderActions";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/ui/StatusBadge";
import StatusTimeline from "../components/ui/StatusTimeline";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
} from "../lib/format";
import { PURCHASE_ORDER_STATUS } from "../lib/statuses";
import { Info, TotalRow } from "../components/ui/DetailParts";

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

export default function PurchaseOrderDetailPage() {
    const { id } = useParams();
    const [action, setAction] = useState(null); // 'approve' | 'receive' | 'cancel'

    const query = useQuery({
        queryKey: ["purchase-order", id],
        queryFn: () => getPurchaseOrder(id),
    });
    const po = query.data;

    const back = (
        <Link
            to="/purchase-orders"
            className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke daftar PO
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
                            ? "PO tidak ditemukan."
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

    return (
        <>
            {back}

            <PageHeader
                title={po.po_number}
                description={`Tanggal PO ${formatDate(po.order_date)}`}
                actions={
                    <>
                        <StatusBadge
                            map={PURCHASE_ORDER_STATUS}
                            status={po.status}
                        />
                        <PurchaseOrderActions po={po} onAction={setAction} />
                    </>
                }
            />

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <dl className="grid gap-4 rounded-xl bg-white p-5 shadow sm:grid-cols-2">
                        <Info label="Supplier">
                            {po.supplier?.name}
                            <span className="block text-xs text-slate-500">
                                {po.supplier?.code}
                            </span>
                        </Info>
                        <Info label="Gudang tujuan">{po.warehouse?.name}</Info>
                        <Info label="Perkiraan datang">
                            {po.expected_date
                                ? formatDate(po.expected_date)
                                : null}
                        </Info>
                        <Info label="Dibuat oleh">
                            {po.created_by
                                ? `${po.created_by.name} · ${formatDateTime(po.created_at)}`
                                : null}
                        </Info>
                        <Info label="Disetujui oleh">
                            {po.approved_by
                                ? `${po.approved_by.name} · ${formatDateTime(po.approved_at)}`
                                : null}
                        </Info>
                        <Info label="Diterima oleh">
                            {po.received_by
                                ? `${po.received_by.name} · ${formatDateTime(po.received_at)}`
                                : null}
                        </Info>
                        {po.notes && (
                            <div className="sm:col-span-2">
                                <Info label="Catatan">{po.notes}</Info>
                            </div>
                        )}
                    </dl>

                    <DataTable
                        columns={ITEM_COLUMNS}
                        rows={po.items}
                        emptyMessage="PO ini belum punya item."
                    />

                    <div className="ml-auto w-full max-w-xs space-y-1 rounded-xl bg-white p-4 text-sm shadow">
                        <TotalRow label="Subtotal" value={po.subtotal} />
                        <TotalRow label="Pajak" value={po.tax_amount} />
                        <TotalRow label="Total" value={po.total} strong />
                    </div>
                </div>

                <aside className="h-fit rounded-xl bg-white p-5 shadow">
                    <h2 className="mb-4 text-sm font-semibold text-slate-800">
                        Histori status
                    </h2>
                    <StatusTimeline
                        histories={po.status_histories}
                        map={PURCHASE_ORDER_STATUS}
                    />
                </aside>
            </div>

            {action && (
                <PurchaseOrderActionDialog
                    action={action}
                    po={po}
                    onClose={() => setAction(null)}
                />
            )}
        </>
    );
}
