import { formatCurrency } from "../../lib/format";

export function Info({ label, children }) {
    return (
        <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">{children || "-"}</dd>
        </div>
    );
}

export function TotalRow({ label, value, strong }) {
    return (
        <div
            className={`flex justify-between ${strong ? "border-t border-slate-200 pt-2 text-base font-semibold" : ""}`}>
            <span className={strong ? "text-slate-800" : "text-slate-500"}>
                {label}
            </span>
            <span className="whitespace-nowrap">{formatCurrency(value)}</span>
        </div>
    );
}
