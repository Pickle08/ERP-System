import axios from "axios";

export const TOKEN_KEY = "erp_token";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    headers: { Accept: "application/json" },
});

// AuthProvider mendaftarkan fungsi pembersih sesi di sini
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
    onUnauthorized = fn;
};

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // 401 di luar halaman login = token kedaluwarsa/tidak valid
        const isLogin = error.config?.url?.includes("/auth/login");
        if (error.response?.status === 401 && !isLogin) onUnauthorized();

        return Promise.reject(error);
    },
);

export default api;
