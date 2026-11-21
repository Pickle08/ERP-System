import api from "./client";

export const getSalesOrders = (params) =>
    api.get("/sales-orders", { params }).then((res) => res.data);

export const getSalesOrder = (id) =>
    api.get(`/sales-orders/${id}`).then((res) => res.data.data);

export const createSalesOrder = (payload) =>
    api.post("/sales-orders", payload).then((res) => res.data.data);

export const updateSalesOrder = (id, payload) =>
    api.put(`/sales-orders/${id}`, payload).then((res) => res.data.data);

const transition = (action) => (id, note) =>
    api
        .post(`/sales-orders/${id}/${action}`, { note: note || null })
        .then((res) => res.data.data);

export const confirmSalesOrder = transition("confirm");
export const issueSalesOrder = transition("issue");
export const cancelSalesOrder = transition("cancel");
