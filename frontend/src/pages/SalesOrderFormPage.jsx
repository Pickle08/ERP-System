import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getSalesOrder } from "../api/salesOrders";
import SalesOrderForm from "../components/sales-orders/SalesOrderForm";
import Spinner from "../components/Spinner";
import PageHeader from "../components/ui/PageHeader";

export default function SalesOrderFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);

    const query = useQuery({
        queryKey: ["sales-order", id],
        queryFn: () => getSalesOrder(id),
        enabled: isEdit,
    });
    const so = query.data;

    const backTo = isEdit ? `/sales-orders/${id}` : "/sales-orders";
    const back = (
        <Link
            to={backTo}
            className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
            <ArrowLeft className="h-4 w-4" />{" "}
            {isEdit ? "Kembali ke detail SO" : "Kembali ke daftar SO"}
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
            notFound ? "SO tidak ditemukan." : getErrorMessage(query.error),
            "text-red-600",
        );
    }

    if (isEdit && so.status !== "draft") {
        return message("SO hanya bisa diubah saat berstatus draft.");
    }

    return (
        <>
            {back}
            <PageHeader
                title={isEdit ? `Ubah ${so.so_number}` : "Buat Sales Order"}
                description={
                    isEdit
                        ? "Perubahan hanya bisa dilakukan selama SO masih draft."
                        : "SO baru disimpan sebagai draft."
                }
            />
            <SalesOrderForm key={so?.id ?? "new"} so={so} />
        </>
    );
}
