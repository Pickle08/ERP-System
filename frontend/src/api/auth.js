import api from "./client";

export const login = (credentials) =>
    api.post("/auth/login", credentials).then((res) => res.data);

export const fetchMe = () => api.get("/auth/me").then((res) => res.data.user);

export const logout = () => api.post("/auth/logout");
