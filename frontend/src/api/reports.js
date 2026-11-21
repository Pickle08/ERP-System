import api from "./client";

const report = (path) => (params) =>
    api.get(`/reports/${path}`, { params }).then((res) => res.data.data);

export const getSummaryReport = report("summary");
export const getSalesReport = report("sales");
export const getPurchasesReport = report("purchases");
export const getReceivablesReport = report("receivables");
export const getExpensesReport = report("expenses");
