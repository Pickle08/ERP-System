import Badge from "./Badge";

// map: { kode_status: { label, tone } } dari lib/statuses.js
export default function StatusBadge({ map, status }) {
    const { label, tone } = map[status] ?? { label: status, tone: "slate" };

    return <Badge tone={tone}>{label}</Badge>;
}
