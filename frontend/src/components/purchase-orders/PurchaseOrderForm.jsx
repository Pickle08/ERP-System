import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import {
    createPurchaseOrder,
    updatePurchaseOrder,
} from "../../api/purchaseOrders";
import { getActiveSuppliers } from "../../api/suppliers";
import { getWarehouses } from "../../api/warehouses";
import { formatCurrency, todayInJakarta } from "../../lib/format";
import { inputClass } from "../../lib/ui";
import ProductPicker from "../products/ProductPicker";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import ErrorText from "../ui/ErrorText";

const MAX_ITEMS = 100;
const KNOWN_FIELDS = [
    "supplier_id",
    "warehouse_id",
    "order_date",
    "expected_date",
    "tax_amount",
    "notes",
];
const ROW_ERROR_KEY = {
    product: "product_id",
    quantity: "quantity",
    unit_price: "unit_price",
};

let rowSeq = 0;
const newRow = (item) => ({
    key: ++rowSeq, // kunci React yang stabil, bukan indeks
    product: item?.product ?? null,
    quantity: item?.quantity ?? "",
    unit_price: item?.unit_price ?? "",
});

function initialState(po) {
    return {
        supplier_id: po?.supplier?.id ?? "",
        warehouse_id: po?.warehouse?.id ?? "",
        order_date: po?.order_date ?? todayInJakarta(),
        expected_date: po?.expected_date ?? "",
        tax_amount: po?.tax_amount ?? "",
        notes: po?.notes ?? "",
        items: po?.items?.length ? po.items.map(newRow) : [newRow()],
    };
}

// Validasi ringan di sisi klien; aturan sebenarnya tetap dijaga backend
function validate(form) {
    const errors = {};

    if (!form.supplier_id) errors.supplier_id = "Pilih supplier.";
    if (!form.warehouse_id) errors.warehouse_id = "Pilih gudang tujuan.";
    if (!form.order_date) errors.order_date = "Tanggal PO wajib diisi.";
    if (
        form.expected_date &&
        form.order_date &&
        form.expected_date < form.order_date
    ) {
        errors.expected_date = "Tidak boleh sebelum tanggal PO.";
    }
    if (form.tax_amount !== "" && Number(form.tax_amount) < 0)
        errors.tax_amount = "Pajak tidak boleh negatif.";

    const seen = new Set();
    form.items.forEach((row, i) => {
        if (!row.product) errors[`items.${i}.product_id`] = "Pilih produk.";
        else if (seen.has(row.product.id))
            errors[`items.${i}.product_id`] = "Produk sudah ada di baris lain.";
        else seen.add(row.product.id);

        if (!(Number(row.quantity) > 0))
            errors[`items.${i}.quantity`] = "Harus lebih dari 0.";
        if (row.unit_price === "" || Number(row.unit_price) < 0) {
            errors[`items.${i}.unit_price`] =
                "Wajib diisi, tidak boleh negatif.";
        }
    });

    return errors;
}

const rowEstimate = (row) =>
    (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);

// po: objek PO untuk mode ubah; kosong = mode buat baru
export default function PurchaseOrderForm({ po }) {
    const isEdit = Boolean(po);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();

    const [form, setForm] = useState(() => initialState(po));
    const [clientErrors, setClientErrors] = useState({});

    const suppliers = useQuery({
        queryKey: ["suppliers", "active"],
        queryFn: getActiveSuppliers,
        staleTime: 5 * 60_000,
    });
    const warehouses = useQuery({
        queryKey: ["warehouses"],
        queryFn: getWarehouses,
        staleTime: 10 * 60_000,
    });

    const warehouseList = warehouses.data ?? [];
    const warehouseId = form.warehouse_id || (warehouseList[0]?.id ?? "");

    // Supplier PO yang sedang diubah harus tetap muncul walau sekarang sudah nonaktif
    const activeSuppliers = suppliers.data ?? [];
    const supplierOptions =
        po?.supplier && !activeSuppliers.some((s) => s.id === po.supplier.id)
            ? [po.supplier, ...activeSuppliers]
            : activeSuppliers;

    const mutation = useMutation({
        mutationFn: (payload) =>
            isEdit
                ? updatePurchaseOrder(po.id, payload)
                : createPurchaseOrder(payload),
        onSuccess: (saved) => {
            queryClient.setQueryData(
                ["purchase-order", String(saved.id)],
                saved,
            );
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            toast.success(
                isEdit
                    ? `PO ${saved.po_number} diperbarui.`
                    : `PO ${saved.po_number} dibuat sebagai draft.`,
            );
            navigate(`/purchase-orders/${saved.id}`);
        },
        onError: () => {
            // misal 409 (PO sudah tidak draft): muat ulang supaya halaman detail tidak basi
            if (isEdit)
                queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
        },
    });

    const serverErrors = getFieldErrors(mutation.error);
    const errors = { ...serverErrors, ...clientErrors };
    const hasErrors = Object.values(errors).some(Boolean);

    const isKnown = (key) =>
        KNOWN_FIELDS.includes(key) || key.startsWith("items");
    const unmapped = Object.entries(serverErrors).find(
        ([key]) => !isKnown(key),
    )?.[1];
    const generalError =
        unmapped ??
        (mutation.isError && Object.keys(serverErrors).length === 0
            ? getErrorMessage(mutation.error)
            : null);

    const clearError = (key) => {
        setClientErrors((prev) => ({ ...prev, [key]: undefined }));
        if (mutation.isError) mutation.reset();
    };

    const setField = (name) => (e) => {
        setForm((prev) => ({ ...prev, [name]: e.target.value }));
        clearError(name);
    };

    const setRow = (index, patch) => {
        setForm((prev) => ({
            ...prev,
            items: prev.items.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        }));
        Object.keys(patch).forEach((field) =>
            clearError(`items.${index}.${ROW_ERROR_KEY[field]}`),
        );
        clearError("items");
    };

    const pickProduct = (index, product) =>
        // harga satuan awal = harga beli di master produk (tetap bisa diubah)
        setRow(index, {
            product,
            unit_price: product ? (product.cost_price ?? "") : "",
        });

    const addRow = () =>
        setForm((prev) =>
            prev.items.length >= MAX_ITEMS
                ? prev
                : { ...prev, items: [...prev.items, newRow()] },
        );

    const removeRow = (index) => {
        setForm((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
        // indeks baris bergeser, jadi pesan error lama tidak boleh dipertahankan
        setClientErrors({});
        mutation.reset();
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const found = validate({ ...form, warehouse_id: warehouseId });
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate({
            supplier_id: form.supplier_id,
            warehouse_id: warehouseId,
            order_date: form.order_date,
            expected_date: form.expected_date || null,
            tax_amount: form.tax_amount === "" ? 0 : form.tax_amount,
            notes: form.notes.trim() || null,
            items: form.items.map((row) => ({
                product_id: row.product.id,
                quantity: row.quantity, // string: tidak ada float di jalur ini
                unit_price: row.unit_price,
            })),
        });
    };

    const estimatedSubtotal = form.items.reduce(
        (sum, row) => sum + rowEstimate(row),
        0,
    );
    const estimatedTax = Number(form.tax_amount) || 0;
    const busy = mutation.isPending;
    const usedProductIds = form.items
        .map((row) => row.product?.id)
        .filter(Boolean);

    return (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
            {generalError && (
                <div
                    role="alert"
                    className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {generalError}
                </div>
            )}
            {!generalError && hasErrors && (
                <div
                    role="alert"
                    className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Ada isian yang perlu diperbaiki. Periksa kolom yang bertanda
                    merah.
                </div>
            )}

            <section className="grid gap-4 rounded-xl bg-white p-5 shadow sm:grid-cols-2">
                <Field
                    label="Supplier"
                    htmlFor="supplier_id"
                    error={errors.supplier_id}>
                    <select
                        id="supplier_id"
                        value={form.supplier_id}
                        onChange={setField("supplier_id")}
                        disabled={suppliers.isLoading}
                        className={inputClass(!!errors.supplier_id)}>
                        <option value="">
                            {suppliers.isLoading
                                ? "Memuat..."
                                : "Pilih supplier"}
                        </option>
                        {supplierOptions.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label="Gudang tujuan"
                    htmlFor="warehouse_id"
                    error={errors.warehouse_id}>
                    {warehouseList.length === 1 ? (
                        <p className="py-2 text-sm text-slate-700">
                            {warehouseList[0].name}
                        </p>
                    ) : (
                        <select
                            id="warehouse_id"
                            value={warehouseId}
                            onChange={setField("warehouse_id")}
                            disabled={warehouses.isLoading}
                            className={inputClass(!!errors.warehouse_id)}>
                            {warehouses.isLoading && (
                                <option value="">Memuat...</option>
                            )}
                            {warehouseList.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>

                <Field
                    label="Tanggal PO"
                    htmlFor="order_date"
                    error={errors.order_date}>
                    <input
                        id="order_date"
                        type="date"
                        value={form.order_date}
                        onChange={setField("order_date")}
                        className={inputClass(!!errors.order_date)}
                    />
                </Field>

                <Field
                    label="Perkiraan barang datang (opsional)"
                    htmlFor="expected_date"
                    error={errors.expected_date}>
                    <input
                        id="expected_date"
                        type="date"
                        min={form.order_date || undefined}
                        value={form.expected_date}
                        onChange={setField("expected_date")}
                        className={inputClass(!!errors.expected_date)}
                    />
                </Field>
            </section>

            <section className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">
                    Item pesanan
                </h2>

                <div className="hidden grid-cols-12 gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid">
                    <span className="col-span-5">Produk</span>
                    <span className="col-span-2">Jumlah</span>
                    <span className="col-span-2">Harga satuan</span>
                    <span className="col-span-2 text-right">
                        Subtotal (estimasi)
                    </span>
                    <span className="col-span-1" />
                </div>

                <div className="space-y-3">
                    {form.items.map((row, index) => (
                        <div
                            key={row.key}
                            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12 sm:items-start sm:border-0 sm:p-0">
                            <div className="sm:col-span-5">
                                <span className="mb-1 block text-xs text-slate-500 sm:hidden">
                                    Produk
                                </span>
                                <ProductPicker
                                    value={row.product}
                                    onChange={(product) =>
                                        pickProduct(index, product)
                                    }
                                    excludeIds={usedProductIds.filter(
                                        (id) => id !== row.product?.id,
                                    )}
                                    error={errors[`items.${index}.product_id`]}
                                    ariaLabel={`Produk baris ${index + 1}`}
                                />
                                <ErrorText
                                    message={
                                        errors[`items.${index}.product_id`]
                                    }
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <span className="mb-1 block text-xs text-slate-500 sm:hidden">
                                    Jumlah
                                </span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.001"
                                    min="0"
                                    aria-label={`Jumlah baris ${index + 1}`}
                                    value={row.quantity}
                                    onChange={(e) =>
                                        setRow(index, {
                                            quantity: e.target.value,
                                        })
                                    }
                                    className={inputClass(
                                        !!errors[`items.${index}.quantity`],
                                    )}
                                />
                                {row.product?.unit && (
                                    <span className="mt-1 block text-xs text-slate-400">
                                        {row.product.unit.code}
                                    </span>
                                )}
                                <ErrorText
                                    message={errors[`items.${index}.quantity`]}
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <span className="mb-1 block text-xs text-slate-500 sm:hidden">
                                    Harga satuan
                                </span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0"
                                    aria-label={`Harga satuan baris ${index + 1}`}
                                    value={row.unit_price}
                                    onChange={(e) =>
                                        setRow(index, {
                                            unit_price: e.target.value,
                                        })
                                    }
                                    className={inputClass(
                                        !!errors[`items.${index}.unit_price`],
                                    )}
                                />
                                <ErrorText
                                    message={
                                        errors[`items.${index}.unit_price`]
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between sm:col-span-2 sm:justify-end sm:pt-2">
                                <span className="text-xs text-slate-500 sm:hidden">
                                    Subtotal (estimasi)
                                </span>
                                <span className="whitespace-nowrap text-sm font-medium text-slate-700">
                                    {formatCurrency(rowEstimate(row))}
                                </span>
                            </div>

                            <div className="flex justify-end sm:col-span-1 sm:pt-1">
                                <button
                                    type="button"
                                    onClick={() => removeRow(index)}
                                    disabled={form.items.length === 1}
                                    aria-label={`Hapus baris ${index + 1}`}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <ErrorText message={errors.items} />

                <button
                    type="button"
                    onClick={addRow}
                    disabled={form.items.length >= MAX_ITEMS}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50">
                    <Plus className="h-4 w-4" /> Tambah item
                </button>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl bg-white p-5 shadow lg:col-span-2">
                    <Field
                        label="Catatan (opsional)"
                        htmlFor="notes"
                        error={errors.notes}>
                        <textarea
                            id="notes"
                            rows={3}
                            value={form.notes}
                            onChange={setField("notes")}
                            className={inputClass(!!errors.notes)}
                        />
                    </Field>
                </div>

                <div className="space-y-3 rounded-xl bg-white p-5 shadow">
                    <Field
                        label="Pajak (nominal)"
                        htmlFor="tax_amount"
                        error={errors.tax_amount}>
                        <input
                            id="tax_amount"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={form.tax_amount}
                            onChange={setField("tax_amount")}
                            className={inputClass(!!errors.tax_amount)}
                        />
                    </Field>

                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span className="whitespace-nowrap">
                                {formatCurrency(estimatedSubtotal)}
                            </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Pajak</span>
                            <span className="whitespace-nowrap">
                                {formatCurrency(estimatedTax)}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800">
                            <span>Total</span>
                            <span className="whitespace-nowrap">
                                {formatCurrency(
                                    estimatedSubtotal + estimatedTax,
                                )}
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">
                        Angka di atas hanya estimasi. Total resmi dihitung
                        server saat disimpan dan bisa beda beberapa sen karena
                        pembulatan.
                    </p>
                </div>
            </section>

            <div className="flex justify-end gap-2">
                <Link
                    to={
                        isEdit
                            ? `/purchase-orders/${po.id}`
                            : "/purchase-orders"
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Batal
                </Link>
                <button
                    type="submit"
                    disabled={
                        busy || warehouses.isLoading || suppliers.isLoading
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {busy
                        ? "Menyimpan..."
                        : isEdit
                          ? "Simpan Perubahan"
                          : "Simpan sebagai Draft"}
                </button>
            </div>
        </form>
    );
}
