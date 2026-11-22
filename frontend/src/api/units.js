import api from "./client";

export const getAllUnits = () =>
    api
        .get("/units", { params: { per_page: 100 } })
        .then((res) => res.data.data);
