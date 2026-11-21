import api from "./client";

export const getExpenses = (params) =>
    api.get("/expenses", { params }).then((res) => res.data);

export const createExpense = (payload) =>
    api.post("/expenses", payload).then((res) => res.data.data);

export const voidExpense = (id, reason) =>
    api.post(`/expenses/${id}/void`, { reason }).then((res) => res.data.data);
