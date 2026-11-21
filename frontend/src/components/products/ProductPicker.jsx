import { useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getProducts } from "../../api/products";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "../../lib/format";
import { inputClass } from "../../lib/ui";

// value: objek produk terpilih (minimal { id, sku, name }) atau null
// excludeIds: id produk yang tidak boleh muncul lagi (sudah dipilih di baris lain)
export default function ProductPicker({
    value,
    onChange,
    excludeIds = [],
    error,
    ariaLabel = "Produk",
    priceField = "cost_price", // SO pakai 'sell_price'
    priceLabel = "Harga beli",
    showStock = false,
}) {
    const listId = useId();
    const label = value ? `${value.sku} — ${value.name}` : "";

    const [query, setQuery] = useState(null); // null = tidak sedang mengetik, tampilkan label terpilih
    const [typed, setTyped] = useState(false); // false = baru fokus, tampilkan saran tanpa memfilter
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const search = useDebouncedValue(typed ? (query ?? "").trim() : "", 300);

    const results = useQuery({
        queryKey: ["product-search", search],
        queryFn: () =>
            getProducts({
                search: search || undefined,
                is_active: 1,
                per_page: 10,
            }),
        enabled: open,
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

    const options = (results.data?.data ?? []).filter(
        (product) => !excludeIds.includes(product.id),
    );

    const close = () => {
        setOpen(false);
        setQuery(null);
        setTyped(false);
    };

    const choose = (product) => {
        onChange(product);
        close();
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && open) {
            e.preventDefault(); // jangan submit form saat memilih
            if (options[active]) choose(options[active]);
        } else if (e.key === "Escape" && open) {
            close();
        }
    };

    return (
        <div className="relative">
            <input
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-label={ariaLabel}
                autoComplete="off"
                placeholder="Cari produk (nama atau SKU)..."
                value={query ?? label}
                onFocus={(e) => {
                    setQuery(label);
                    setTyped(false);
                    setActive(0);
                    setOpen(true);
                    e.target.select();
                }}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setTyped(true);
                    setActive(0);
                    setOpen(true);
                }}
                onBlur={close}
                onKeyDown={onKeyDown}
                className={inputClass(!!error)}
            />

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {results.isLoading && (
                        <li className="px-3 py-2 text-sm text-slate-500">
                            Memuat...
                        </li>
                    )}
                    {results.isError && (
                        <li className="px-3 py-2 text-sm text-red-600">
                            Gagal memuat produk.
                        </li>
                    )}
                    {!results.isLoading &&
                        !results.isError &&
                        options.length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-500">
                                Produk tidak ditemukan.
                            </li>
                        )}

                    {options.map((product, index) => (
                        <li
                            key={product.id}
                            role="option"
                            aria-selected={index === active}
                            // mousedown (bukan click) + preventDefault supaya input tidak kehilangan fokus sebelum terpilih
                            onMouseDown={(e) => {
                                e.preventDefault();
                                choose(product);
                            }}
                            onMouseEnter={() => setActive(index)}
                            className={`cursor-pointer px-3 py-2 text-sm ${index === active ? "bg-indigo-50" : ""}`}>
                            <span className="font-mono text-xs text-slate-500">
                                {product.sku}
                            </span>{" "}
                            <span className="font-medium text-slate-800">
                                {product.name}
                            </span>
                            <span className="block text-xs text-slate-500">
                                {priceLabel}{" "}
                                {formatCurrency(product[priceField])}
                                {product.unit ? ` / ${product.unit.code}` : ""}
                                {showStock &&
                                    ` · Stok ${formatNumber(product.stock_quantity ?? 0)}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
