import api from "./client";

export const getInvoices = (params) =>
    api.get("/invoices", { params }).then((res) => res.data);

export const getInvoice = (id) =>
    api.get(`/invoices/${id}`).then((res) => res.data.data);
