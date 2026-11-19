import { useSearchParams } from "react-router-dom";

// State halaman list (page, search, filter) disimpan di URL
export function useListParams() {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const get = (key) => searchParams.get(key) ?? "";
    const hasFilters = [...searchParams.keys()].some((key) => key !== "page");

    const update = (changes) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);

                for (const [key, value] of Object.entries(changes)) {
                    if (value === "" || value == null || value === false)
                        next.delete(key);
                    else next.set(key, String(value));
                }

                // Filter berubah -> kembali ke halaman 1, kecuali yang diubah memang halamannya
                if (!("page" in changes)) next.delete("page");

                return next;
            },
            { replace: true },
        );
    };

    const reset = () => setSearchParams({}, { replace: true });

    return { page, get, update, reset, hasFilters };
}
