import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getActiveCustomers } from "../../api/customers";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { createSalesOrder, updateSalesOrder } from "../../api/salesOrders";
import { getWarehouses } from "../../api/warehouses";
import { formatCurrency, formatNumber, todayInJakarta } from "../../lib/format";
import { inputClass } from "../../lib/ui";
import ProductPicker from "../products/ProductPicker";
import { useToast } from "../toast/useToast";
import ErrorText from "../ui/ErrorText";
import Field from "../ui/Field";

const MAX_ITEMS = 100;
const KNOWN_FIELDS = [
    "customer_id",
    "warehouse_id",
    "order_date",
    "payment_terms_days",
    "tax_amount",
    "notes",
];
const ROW_ERROR_KEY = {
    product: "product_id",
    quantity: "quantity",
    unit_price: "unit_price",
    discount_percent: "discount_percent",
};

let rowSeq = 0;
const newRow = (item) => ({
    key: ++rowSeq, // kunci React yang stabil, bukan indeks
    product: item?.product ?? null,
    quantity: item?.quantity ?? "",
    unit_price: item?.unit_price ?? "",
    discount_percent: item?.discount_percent ?? "",
});

function initialState(so) {
    return {
        customer_id: so?.customer?.id ?? "",
        warehouse_id: so?.warehouse?.id ?? "",
        order_date: so?.order_date ?? todayInJakarta(),
        payment_terms_days: String(so?.payment_terms_days ?? 0),
        tax_amount: so?.tax_amount ?? "",
        notes: so?.notes ?? "",
        items: so?.items?.length ? so.items.map(newRow) : [newRow()],
    };
}

// Validasi ringan di sisi klien; aturan sebenarnya tetap dijaga backend
function validate(form) {
    const errors = {};
    const terms = Number(form.payment_terms_days);

    if (!form.customer_id) errors.customer_id = "Pilih customer.";
    if (!form.warehouse_id) errors.warehouse_id = "Pilih gudang asal barang.";
    if (!form.order_date) errors.order_date = "Tanggal SO wajib diisi.";
    if (
        form.payment_terms_days === "" ||
        !Number.isInteger(terms) ||
        terms < 0 ||
        terms > 365
    ) {
        errors.payment_terms_days = "Isi 0 sampai 365 hari (0 = tunai).";
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
        if (
            row.discount_percent !== "" &&
            (Number(row.discount_percent) < 0 ||
                Number(row.discount_percent) > 100)
        ) {
            errors[`items.${i}.discount_percent`] = "Harus 0 sampai 100.";
        }
    });

    return errors;
}

const rowEstimate = (row) =>
    (Number(row.quantity) || 0) *
    (Number(row.unit_price) || 0) *
    (1 - (Number(row.discount_percent) || 0) / 100);

// so: objek SO untuk mode ubah; kosong = mode buat baru
export default function SalesOrderForm({ so }) {
    const isEdit = Boolean(so);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();

    const [form, setForm] = useState(() => initialState(so));
    const [clientErrors, setClientErrors] = useState({});

    const customers = useQuery({
        queryKey: ["customers", "active"],
        queryFn: getActiveCustomers,
        staleTime: 5 * 60_000,
    });
    const warehouses = useQuery({
        queryKey: ["warehouses"],
        queryFn: getWarehouses,
        staleTime: 10 * 60_000,
    });

    const warehouseList = warehouses.data ?? [];
    const warehouseId = form.warehouse_id || (warehouseList[0]?.id ?? "");

    // Customer SO yang sedang diubah harus tetap muncul walau sekarang sudah nonaktif
    const activeCustomers = customers.data ?? [];
    const customerOptions =
        so?.customer && !activeCustomers.some((c) => c.id === so.customer.id)
            ? [so.customer, ...activeCustomers]
            : activeCustomers;

    const mutation = useMutation({
        mutationFn: (payload) =>
            isEdit
                ? updateSalesOrder(so.id, payload)
                : createSalesOrder(payload),
        onSuccess: (saved) => {
            queryClient.setQueryData(["sales-order", String(saved.id)], saved);
            queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
            toast.success(
                isEdit
                    ? `SO ${saved.so_number} diperbarui.`
                    : `SO ${saved.so_number} dibuat sebagai draft.`,
            );
            navigate(`/sales-orders/${saved.id}`);
        },
        onError: () => {
            if (isEdit)
                queryClient.invalidateQueries({ queryKey: ["sales-order"] });
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
        // harga satuan awal = harga jual di master produk (tetap bisa diubah)
        setRow(index, {
            product,
            unit_price: product ? (product.sell_price ?? "") : "",
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
        setClientErrors({}); // indeks baris bergeser, pesan error lama tidak boleh dipertahankan
        mutation.reset();
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const found = validate({ ...form, warehouse_id: warehouseId });
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate({
            customer_id: form.customer_id,
            warehouse_id: warehouseId,
            order_date: form.order_date,
            payment_terms_days: Number(form.payment_terms_days),
            tax_amount: form.tax_amount === "" ? 0 : form.tax_amount,
            notes: form.notes.trim() || null,
            items: form.items.map((row) => ({
                product_id: row.product.id,
                quantity: row.quantity, // string: tidak ada float di jalur ini
                unit_price: row.unit_price,
                discount_percent:
                    row.discount_percent === "" ? 0 : row.discount_percent,
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
                    label="Customer"
                    htmlFor="customer_id"
                    error={errors.customer_id}>
                    <select
                        id="customer_id"
                        value={form.customer_id}
                        onChange={setField("customer_id")}
                        disabled={customers.isLoading}
                        className={inputClass(!!errors.customer_id)}>
                        <option value="">
                            {customers.isLoading
                                ? "Memuat..."
                                : "Pilih customer"}
                        </option>
                        {customerOptions.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label="Gudang asal barang"
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
                    label="Tanggal SO"
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
                    label="Termin pembayaran (hari)"
                    htmlFor="payment_terms_days"
                    error={errors.payment_terms_days}
                    hint="0 = tunai. Menentukan jatuh tempo invoice.">
                    <input
                        id="payment_terms_days"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        max="365"
                        list="payment-terms-options"
                        value={form.payment_terms_days}
                        onChange={setField("payment_terms_days")}
                        className={inputClass(!!errors.payment_terms_days)}
                    />
                    <datalist id="payment-terms-options">
                        {[0, 7, 14, 30, 45, 60].map((days) => (
                            <option key={days} value={days} />
                        ))}
                    </datalist>
                </Field>
            </section>

            <section className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">
                    Item pesanan
                </h2>

                <div className="space-y-3">
                    {form.items.map((row, index) => {
                        const stock = row.product?.stock_quantity;
                        const hasStockInfo = row.product && stock !== undefined;
                        const available = Number(stock ?? 0);
                        const short =
                            hasStockInfo && Number(row.quantity) > available;

                        return (
                            <div
                                key={row.key}
                                className="space-y-3 rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">
                                        Item {index + 1}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeRow(index)}
                                        disabled={form.items.length === 1}
                                        aria-label={`Hapus item ${index + 1}`}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div>
                                    <ProductPicker
                                        value={row.product}
                                        onChange={(product) =>
                                            pickProduct(index, product)
                                        }
                                        excludeIds={usedProductIds.filter(
                                            (id) => id !== row.product?.id,
                                        )}
                                        error={
                                            errors[`items.${index}.product_id`]
                                        }
                                        ariaLabel={`Produk item ${index + 1}`}
                                        priceField="sell_price"
                                        priceLabel="Harga jual"
                                        showStock
                                    />
                                    <ErrorText
                                        message={
                                            errors[`items.${index}.product_id`]
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <div>
                                        <label
                                            htmlFor={`qty-${row.key}`}
                                            className="mb-1 block text-xs text-slate-500">
                                            Jumlah
                                            {row.product?.unit
                                                ? ` (${row.product.unit.code})`
                                                : ""}
                                        </label>
                                        <input
                                            id={`qty-${row.key}`}
                                            type="number"
                                            inputMode="decimal"
                                            step="0.001"
                                            min="0"
                                            value={row.quantity}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    quantity: e.target.value,
                                                })
                                            }
                                            className={inputClass(
                                                !!errors[
                                                    `items.${index}.quantity`
                                                ],
                                            )}
                                        />
                                        {hasStockInfo && (
                                            <span
                                                className={`mt-1 block text-xs ${short ? "text-amber-600" : "text-slate-400"}`}>
                                                Stok: {formatNumber(available)}
                                                {short
                                                    ? " (kurang dari jumlah ini)"
                                                    : ""}
                                            </span>
                                        )}
                                        <ErrorText
                                            message={
                                                errors[
                                                    `items.${index}.quantity`
                                                ]
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor={`price-${row.key}`}
                                            className="mb-1 block text-xs text-slate-500">
                                            Harga satuan
                                        </label>
                                        <input
                                            id={`price-${row.key}`}
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min="0"
                                            value={row.unit_price}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    unit_price: e.target.value,
                                                })
                                            }
                                            className={inputClass(
                                                !!errors[
                                                    `items.${index}.unit_price`
                                                ],
                                            )}
                                        />
                                        <ErrorText
                                            message={
                                                errors[
                                                    `items.${index}.unit_price`
                                                ]
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor={`disc-${row.key}`}
                                            className="mb-1 block text-xs text-slate-500">
                                            Diskon (%)
                                        </label>
                                        <input
                                            id={`disc-${row.key}`}
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={row.discount_percent}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    discount_percent:
                                                        e.target.value,
                                                })
                                            }
                                            className={inputClass(
                                                !!errors[
                                                    `items.${index}.discount_percent`
                                                ],
                                            )}
                                        />
                                        <ErrorText
                                            message={
                                                errors[
                                                    `items.${index}.discount_percent`
                                                ]
                                            }
                                        />
                                    </div>

                                    <div>
                                        <span className="mb-1 block text-xs text-slate-500">
                                            Subtotal (estimasi)
                                        </span>
                                        <p className="whitespace-nowrap py-2 text-sm font-medium text-slate-700">
                                            {formatCurrency(rowEstimate(row))}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                        pembulatan. Peringatan stok bersifat informasi;
                        pengecekan sebenarnya terjadi saat konfirmasi.
                    </p>
                </div>
            </section>

            <div className="flex justify-end gap-2">
                <Link
                    to={isEdit ? `/sales-orders/${so.id}` : "/sales-orders"}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Batal
                </Link>
                <button
                    type="submit"
                    disabled={
                        busy || warehouses.isLoading || customers.isLoading
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
