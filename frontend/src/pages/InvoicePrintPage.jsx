import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../api/errors";
import { getInvoice } from "../api/invoices";
import Spinner from "../components/Spinner";
import { COMPANY } from "../config/company";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
} from "../lib/format";

function Row({ label, value, strong }) {
    return (
        <div
            className={`flex justify-between gap-6 py-1 ${strong ? "border-t border-slate-400 pt-2 font-bold" : ""}`}>
            <span>{label}</span>
            <span className="whitespace-nowrap">{formatCurrency(value)}</span>
        </div>
    );
}

export default function InvoicePrintPage() {
    const { id } = useParams();
    const query = useQuery({
        queryKey: ["invoice", id],
        queryFn: () => getInvoice(id),
    });
    const invoice = query.data;

    if (query.isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (query.isError) {
        const notFound = query.error?.response?.status === 404;

        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-red-600">
                    {notFound
                        ? "Invoice tidak ditemukan."
                        : getErrorMessage(query.error)}
                </p>
                <Link
                    to="/invoices"
                    className="text-sm text-indigo-600 hover:underline">
                    Ke daftar invoice
                </Link>
            </div>
        );
    }

    const so = invoice.sales_order;
    const isVoid = invoice.status === "void";
    const isPaid = !isVoid && invoice.payment_status === "paid";
    const terms =
        so.payment_terms_days === 0 ? "Tunai" : `${so.payment_terms_days} hari`;

    return (
        <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
            {/* Toolbar: tidak ikut tercetak */}
            <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
                <Link
                    to={`/invoices/${invoice.id}`}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Kembali
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                    <Printer className="h-4 w-4" /> Cetak / Simpan PDF
                </button>
            </div>

            <article className="relative mx-auto max-w-[210mm] bg-white p-10 text-sm text-slate-800 shadow print:max-w-none print:p-0 print:shadow-none">
                {isVoid && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none fixed inset-0 z-10 flex select-none items-center justify-center text-[10rem] font-black text-red-500/15 -rotate-12">
                        VOID
                    </div>
                )}

                <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
                    <div>
                        <h1 className="text-xl font-bold">{COMPANY.name}</h1>
                        <p className="mt-1 max-w-xs whitespace-pre-line text-xs text-slate-600">
                            {COMPANY.address}
                        </p>
                        <p className="text-xs text-slate-600">
                            Telp. {COMPANY.phone}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold tracking-wide">
                            INVOICE
                        </p>
                        <p className="mt-1 font-mono text-sm">
                            {invoice.invoice_number}
                        </p>
                    </div>
                </header>

                <section className="mt-5 grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Ditagihkan kepada
                        </p>
                        <p className="mt-1 font-semibold">
                            {invoice.customer?.name}
                        </p>
                        <p className="text-xs text-slate-500">
                            {invoice.customer?.code}
                        </p>
                        {invoice.customer?.address && (
                            <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                                {invoice.customer.address}
                            </p>
                        )}
                    </div>
                    <dl className="space-y-1 text-xs">
                        <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Tanggal invoice</dt>
                            <dd>{formatDate(invoice.invoice_date)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Jatuh tempo</dt>
                            <dd>{formatDate(invoice.due_date)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Termin</dt>
                            <dd>{terms}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Referensi SO</dt>
                            <dd className="font-mono">{so.so_number}</dd>
                        </div>
                    </dl>
                </section>

                <table className="mt-6 w-full border-collapse text-xs">
                    <thead>
                        <tr className="border-y border-slate-400 bg-slate-100 text-left">
                            <th className="w-8 px-2 py-2">No</th>
                            <th className="px-2 py-2">Produk</th>
                            <th className="px-2 py-2 text-right">Qty</th>
                            <th className="px-2 py-2 text-right">Harga</th>
                            <th className="px-2 py-2 text-right">Diskon</th>
                            <th className="px-2 py-2 text-right">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(so.items ?? []).map((item, index) => (
                            <tr
                                key={item.product.sku}
                                className="break-inside-avoid border-b border-slate-200">
                                <td className="px-2 py-2 align-top">
                                    {index + 1}
                                </td>
                                <td className="px-2 py-2">
                                    {item.product.name}
                                    <span className="block font-mono text-[10px] text-slate-500">
                                        {item.product.sku}
                                    </span>
                                </td>
                                <td className="px-2 py-2 text-right align-top">
                                    {formatNumber(item.quantity)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                                    {formatCurrency(item.unit_price)}
                                </td>
                                <td className="px-2 py-2 text-right align-top">
                                    {Number(item.discount_percent) > 0
                                        ? `${formatNumber(item.discount_percent)}%`
                                        : "-"}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right align-top font-medium">
                                    {formatCurrency(item.line_total)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <section className="mt-4 flex items-start justify-between gap-6">
                    <div className="max-w-xs text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">
                            Pembayaran
                        </p>
                        <p className="mt-1">{COMPANY.bank}</p>
                        {so.notes && (
                            <>
                                <p className="mt-3 font-semibold text-slate-800">
                                    Catatan
                                </p>
                                <p className="mt-1 whitespace-pre-line">
                                    {so.notes}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="relative w-64 text-sm">
                        <Row label="Subtotal" value={invoice.subtotal} />
                        <Row label="Pajak" value={invoice.tax_amount} />
                        <Row label="Total" value={invoice.total} strong />
                        <Row label="Dibayar" value={invoice.paid_amount} />
                        <Row
                            label="Sisa tagihan"
                            value={isVoid ? 0 : invoice.outstanding_amount}
                            strong
                        />

                        {isPaid && (
                            <span className="absolute -top-2 right-0 -rotate-6 rounded border-2 border-emerald-600 px-3 py-1 text-lg font-black tracking-widest text-emerald-700">
                                LUNAS
                            </span>
                        )}
                    </div>
                </section>

                <section className="mt-12 grid grid-cols-2 gap-6 text-center text-xs">
                    <div>
                        <p>Diterima oleh,</p>
                        <div className="h-16" />
                        <p className="border-t border-slate-400 pt-1">
                            (............................)
                        </p>
                    </div>
                    <div>
                        <p>Hormat kami,</p>
                        <div className="h-16" />
                        <p className="border-t border-slate-400 pt-1">
                            {COMPANY.name}
                        </p>
                    </div>
                </section>

                <footer className="mt-8 border-t border-slate-200 pt-2 text-[10px] text-slate-400">
                    Dicetak dari sistem ERP pada {formatDateTime(new Date())}.
                </footer>
            </article>
        </div>
    );
}
