import { formatDateTime } from "../../lib/format";

export default function StatusTimeline({ histories, map }) {
    // sort stabil: entri dengan waktu sama tetap urut seperti dari backend
    const sorted = [...histories].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );
    const labelOf = (status) => map[status]?.label ?? status;

    return (
        <ol className="space-y-4">
            {sorted.map((history, index) => (
                <li key={index} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                    <div>
                        <p className="text-sm font-medium text-slate-800">
                            {history.from_status
                                ? `${labelOf(history.from_status)} → ${labelOf(history.to_status)}`
                                : `Dibuat (${labelOf(history.to_status)})`}
                        </p>
                        <p className="text-xs text-slate-500">
                            {history.changed_by?.name ?? "-"} ·{" "}
                            {formatDateTime(history.created_at)}
                        </p>
                        {history.note && (
                            <p className="mt-1 text-sm text-slate-600">
                                “{history.note}”
                            </p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}
