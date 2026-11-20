import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getPurchaseOrder } from "../api/purchaseOrders";
import PurchaseOrderForm from "../components/purchase-orders/PurchaseOrderForm";
import Spinner from "../components/Spinner";
import PageHeader from "../components/ui/PageHeader";

export default function PurchaseOrderFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);

    const query = useQuery({
        queryKey: ["purchase-order", id],
        queryFn: () => getPurchaseOrder(id),
        enabled: isEdit,
    });
    const po = query.data;

    const backTo = isEdit ? `/purchase-orders/${id}` : "/purchase-orders";
    const back = (
        <Link
            to={backTo}
            className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <ArrowLeft className="h-4 w-4" />{" "}
            {isEdit ? "Kembali ke detail PO" : "Kembali ke daftar PO"}
        </Link>
    );

    const message = (text, tone = "text-slate-600") => (
        <>
            {back}
            <div className="rounded-xl bg-white p-8 text-center shadow">
                <p className={tone}>{text}</p>
            </div>
        </>
    );

    if (isEdit && query.isLoading) {
        return (
            <>
                {back}
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            </>
        );
    }

    if (isEdit && query.isError) {
        const notFound = query.error?.response?.status === 404;

        return message(
            notFound ? "PO tidak ditemukan." : getErrorMessage(query.error),
            "text-red-600",
        );
    }

    if (isEdit && po.status !== "draft") {
        return message("PO hanya bisa diubah saat berstatus draft.");
    }

    return (
        <>
            {back}
            <PageHeader
                title={isEdit ? `Ubah ${po.po_number}` : "Buat Purchase Order"}
                description={
                    isEdit
                        ? "Perubahan hanya bisa dilakukan selama PO masih draft."
                        : "PO baru disimpan sebagai draft."
                }
            />
            {/* key: form dibangun ulang kalau PO berganti, state awal selalu dari data yang benar */}
            <PurchaseOrderForm key={po?.id ?? "new"} po={po} />
        </>
    );
}
