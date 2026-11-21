export const STOCK_MOVE_ROLES = ["admin", "warehouse"];

export const PO_VIEW_ROLES = [
    "admin",
    "procurement",
    "warehouse",
    "finance",
    "owner",
];
export const PO_WRITE_ROLES = ["admin", "procurement"]; // buat, ubah, batalkan
export const PO_APPROVE_ROLES = ["admin", "owner"];
export const PO_RECEIVE_ROLES = ["admin", "warehouse"];
export const SO_VIEW_ROLES = [
    "admin",
    "sales",
    "warehouse",
    "finance",
    "owner",
];
export const SO_WRITE_ROLES = ["admin", "sales"]; // buat, ubah, konfirmasi, batal (sebelum barang keluar)
export const SO_ISSUE_ROLES = ["admin", "warehouse"];
export const SO_CANCEL_ISSUED_ROLES = ["admin"]; // batal SO yang barangnya sudah keluar

export const INVOICE_VIEW_ROLES = ["admin", "sales", "finance", "owner"];

export const FINANCE_VIEW_ROLES = ["admin", "finance", "owner"];
export const FINANCE_WRITE_ROLES = ["admin", "finance"];
