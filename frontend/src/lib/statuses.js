export const PURCHASE_ORDER_STATUS = {
    draft: { label: "Draft", tone: "slate" },
    approved: { label: "Disetujui", tone: "blue" },
    received: { label: "Diterima", tone: "green" },
    cancelled: { label: "Dibatalkan", tone: "red" },
};
export const SALES_ORDER_STATUS = {
    draft: { label: "Draft", tone: "slate" },
    confirmed: { label: "Dikonfirmasi", tone: "blue" },
    issued: { label: "Barang Keluar", tone: "green" },
    cancelled: { label: "Dibatalkan", tone: "red" },
};

export const PAYMENT_STATUS = {
    unpaid: { label: "Belum Bayar", tone: "red" },
    partial: { label: "Sebagian", tone: "amber" },
    paid: { label: "Lunas", tone: "green" },
};

export const INVOICE_STATUS = {
    active: { label: "Aktif", tone: "slate" },
    void: { label: "Void", tone: "red" },
};
