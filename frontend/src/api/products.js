import api from "./client";

export const getProduct = (id) =>
    api.get(`/products/${id}`).then((res) => res.data.data);
