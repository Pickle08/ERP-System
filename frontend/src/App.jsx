import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import StatusPage from "./components/StatusPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import StocksPage from "./pages/StocksPage";
import StockMovementsPage from "./pages/StockMovementsPage";
import { PO_VIEW_ROLES } from "./auth/permissions";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/stocks" element={<StocksPage />} />
                    <Route
                        path="/stocks/:productId/movements"
                        element={<StockMovementsPage />}
                    />
                    <Route element={<ProtectedRoute roles={PO_VIEW_ROLES} />}>
                        <Route
                            path="/purchase-orders"
                            element={<PurchaseOrdersPage />}
                        />
                        <Route
                            path="/purchase-orders/:id"
                            element={<PurchaseOrderDetailPage />}
                        />
                    </Route>
                </Route>
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

            <Route
                path="/stocks/:productId/movements"
                element={<StockMovementsPage />}
            />
        </Routes>
    );
}
