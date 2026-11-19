import api from "./client";

export const getAllCategories = () =>
    api
        .get("/categories", { params: { per_page: 100 } })
        .then((res) => res.data.data);
