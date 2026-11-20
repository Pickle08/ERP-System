import api from "./client";

export const getWarehouses = () =>
    api.get("/warehouses").then((res) => res.data.data);
