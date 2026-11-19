import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import StatusPage from "./components/StatusPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
            </Route>

            <Route
                path="/forbidden"
                element={
                    <StatusPage
                        code="403"
                        title="Akses ditolak"
                        message="Role Anda tidak punya akses ke halaman ini."
                    />
                }
            />
            <Route
                path="*"
                element={
                    <StatusPage
                        code="404"
                        title="Halaman tidak ditemukan"
                        message="Alamat yang Anda buka tidak ada."
                    />
                }
            />
        </Routes>
    );
}
