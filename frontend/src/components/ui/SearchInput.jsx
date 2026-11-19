import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

export default function SearchInput({
    defaultValue = "",
    onSearch,
    placeholder = "Cari...",
    delay = 400,
}) {
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const handleChange = (e) => {
        const value = e.target.value;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onSearch(value.trim()), delay);
    };

    return (
        <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                type="search"
                defaultValue={defaultValue}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>
    );
}
