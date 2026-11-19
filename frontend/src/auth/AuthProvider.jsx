import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TOKEN_KEY, setUnauthorizedHandler } from "../api/client";
import * as authApi from "../api/auth";
import { AuthContext } from "./context";

export function AuthProvider({ children }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    // Kalau ada token tersimpan, kita belum tahu valid atau tidak sampai /auth/me selesai
    const [loading, setLoading] = useState(
        () => !!localStorage.getItem(TOKEN_KEY),
    );

    const clearSession = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        queryClient.clear(); // jangan sisakan data user sebelumnya di cache
    }, [queryClient]);

    // 401 dari request mana pun -> sesi dibersihkan -> ProtectedRoute mengarahkan ke /login
    useEffect(() => {
        setUnauthorizedHandler(clearSession);
    }, [clearSession]);

    // Saat app dibuka: validasi token yang tersimpan ke server
    useEffect(() => {
        if (!localStorage.getItem(TOKEN_KEY)) return;

        authApi
            .fetchMe()
            .then(setUser)
            .catch(clearSession)
            .finally(() => setLoading(false));
    }, [clearSession]);

    const login = useCallback(async (credentials) => {
        const { token, user: loggedIn } = await authApi.login(credentials);
        localStorage.setItem(TOKEN_KEY, token);
        setUser(loggedIn);

        return loggedIn;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // token mungkin sudah kedaluwarsa; tetap bersihkan sesi lokal
        }
        clearSession();
    }, [clearSession]);

    const value = useMemo(
        () => ({ user, loading, login, logout }),
        [user, loading, login, logout],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
