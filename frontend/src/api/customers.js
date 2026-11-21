import api from "./client";

// Untuk filter di daftar (maks 100 customer)
export const getAllCustomers = () =>
    api
        .get("/customers", { params: { per_page: 100 } })
        .then((res) => res.data.data);

// Untuk form: hanya customer aktif, sama seperti aturan backend
export const getActiveCustomers = () =>
    api
        .get("/customers", { params: { per_page: 100, is_active: 1 } })
        .then((res) => res.data.data);
