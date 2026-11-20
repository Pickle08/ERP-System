import api from "./client";

export const getStocks = (params) =>
    api.get("/stocks", { params }).then((res) => res.data);

// type: "in" | "out"
export const postStockMovement = (type, payload) =>
    api.post(`/stocks/${type}`, payload).then((res) => res.data);

export const getStockMovements = (productId, params) =>
    api
        .get(`/stocks/${productId}/movements`, { params })
        .then((res) => res.data);

export const getMovements = (productId, params) =>
    api
        .get(`/stocks/${productId}/movements`, { params })
        .then((res) => res.data);

export const stockIn = (payload) =>
    api.post("/stocks/in", payload).then((res) => res.data);

export const stockOut = (payload) =>
    api.post("/stocks/out", payload).then((res) => res.data);
