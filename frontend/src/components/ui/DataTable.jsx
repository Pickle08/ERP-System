import { getErrorMessage } from "../../api/errors";

const SKELETON_ROWS = 6;

// columns: [{ key, header, cell: (row) => node, align?: 'left' | 'right' }]
export default function DataTable({
    columns,
    rows = [],
    isLoading,
    isFetching,
    error,
    onRetry,
    emptyMessage = "Belum ada data.",
    rowKey = "id",
}) {
    const alignClass = (col) =>
        col.align === "right" ? "text-right" : "text-left";
    const showSkeleton = isLoading && rows.length === 0;

    const messageRow = (content) => (
        <tr>
            <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-slate-500">
                {content}
            </td>
        </tr>
    );

    let body;
    if (showSkeleton) {
        body = Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <tr key={i}>
                {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-200" />
                    </td>
                ))}
            </tr>
        ));
    } else if (error && rows.length === 0) {
        body = messageRow(
            <div className="space-y-3">
                <p className="text-red-600">{getErrorMessage(error)}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        Coba lagi
                    </button>
                )}
            </div>,
        );
    } else if (rows.length === 0) {
        body = messageRow(emptyMessage);
    } else {
        body = rows.map((row) => (
            <tr key={row[rowKey]} className="hover:bg-slate-50">
                {columns.map((col) => (
                    <td
                        key={col.key}
                        className={`px-4 py-3 text-slate-700 ${alignClass(col)}`}>
                        {col.cell(row)}
                    </td>
                ))}
            </tr>
        ));
    }

    return (
        <div className="overflow-hidden rounded-xl bg-white shadow">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={`px-4 py-3 font-semibold text-slate-600 ${alignClass(col)}`}>
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody
                        className={`divide-y divide-slate-100 ${isFetching && !showSkeleton ? "opacity-60" : ""}`}>
                        {body}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
