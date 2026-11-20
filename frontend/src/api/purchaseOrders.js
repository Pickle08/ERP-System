import api from "./client";

export const getPurchaseOrders = (params) =>
    api.get("/purchase-orders", { params }).then((res) => res.data);

export const getPurchaseOrder = (id) =>
    api.get(`/purchase-orders/${id}`).then((res) => res.data.data);

const transition = (action) => (id, note) =>
    api
        .post(`/purchase-orders/${id}/${action}`, { note: note || null })
        .then((res) => res.data.data);

export const approvePurchaseOrder = transition("approve");
export const receivePurchaseOrder = transition("receive");
export const cancelPurchaseOrder = transition("cancel");

export const createPurchaseOrder = (payload) =>
    api.post("/purchase-orders", payload).then((res) => res.data.data);

export const updatePurchaseOrder = (id, payload) =>
    api.put(`/purchase-orders/${id}`, payload).then((res) => res.data.data);
