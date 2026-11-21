import { todayInJakarta } from "./format";

// Hanya penanda tampilan. Laporan umur piutang yang resmi dihitung backend.
export const isOverdue = (invoice) =>
    invoice.status === "active" &&
    Number(invoice.outstanding_amount) > 0 &&
    Boolean(invoice.due_date) &&
    invoice.due_date < todayInJakarta();
