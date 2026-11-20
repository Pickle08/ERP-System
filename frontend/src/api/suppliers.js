import api from "./client";

// Cukup untuk dropdown filter (maks 100 supplier); kalau data membesar, ganti ke pencarian
export const getAllSuppliers = () =>
    api
        .get("/suppliers", { params: { per_page: 100 } })
        .then((res) => res.data.data);
