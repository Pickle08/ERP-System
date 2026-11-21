import api from "./client";

export const getPayments = (params) =>
    api.get("/payments", { params }).then((res) => res.data);

export const recordPayment = (invoiceId, payload) =>
    api
        .post(`/invoices/${invoiceId}/payments`, payload)
        .then((res) => res.data.data);

export const voidPayment = (id, reason) =>
    api.post(`/payments/${id}/void`, { reason }).then((res) => res.data.data);
