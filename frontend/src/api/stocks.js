import api from "./client";

export const getStocks = (params) =>
    api.get("/stocks", { params }).then((res) => res.data);
