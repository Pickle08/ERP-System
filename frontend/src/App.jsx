import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import StatusPage from "./components/StatusPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import StocksPage from "./pages/StocksPage";
import StockMovementsPage from "./pages/StockMovementsPage";
import {
    REPORT_VIEW_ROLES,
    FINANCE_VIEW_ROLES,
    INVOICE_VIEW_ROLES,
    PO_VIEW_ROLES,
    PO_WRITE_ROLES,
    SO_VIEW_ROLES,
    SO_WRITE_ROLES,
} from "./auth/permissions";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseOrderFormPage from "./pages/PurchaseOrderFormPage";
import SalesOrderDetailPage from "./pages/SalesOrderDetailPage";
import SalesOrderFormPage from "./pages/SalesOrderFormPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import InvoicePrintPage from "./pages/InvoicePrintPage";
import InvoicesPage from "./pages/InvoicesPage";
import ExpensesPage from "./pages/ExpensesPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import {
    CATEGORIES,
    CUSTOMERS,
    PRODUCTS,
    SUPPLIERS,
    UNITS,
} from "./config/masterData";
import MasterDataPage from "./pages/MasterDataPage";

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
                    <Route element={<ProtectedRoute roles={PO_WRITE_ROLES} />}>
                        <Route
                            path="/purchase-orders/new"
                            element={<PurchaseOrderFormPage />}
                        />
                        <Route
                            path="/purchase-orders/:id/edit"
                            element={<PurchaseOrderFormPage />}
                        />
                    </Route>
                    <Route element={<ProtectedRoute roles={SO_VIEW_ROLES} />}>
                        <Route
                            path="/sales-orders"
                            element={<SalesOrdersPage />}
                        />
                        <Route
                            path="/sales-orders/:id"
                            element={<SalesOrderDetailPage />}
                        />
                    </Route>

                    <Route element={<ProtectedRoute roles={SO_WRITE_ROLES} />}>
                        <Route
                            path="/sales-orders/new"
                            element={<SalesOrderFormPage />}
                        />
                        <Route
                            path="/sales-orders/:id/edit"
                            element={<SalesOrderFormPage />}
                        />
                    </Route>
                    <Route
                        element={<ProtectedRoute roles={INVOICE_VIEW_ROLES} />}>
                        <Route path="/invoices" element={<InvoicesPage />} />
                        <Route
                            path="/invoices/:id"
                            element={<InvoiceDetailPage />}
                        />
                    </Route>
                    <Route
                        element={<ProtectedRoute roles={FINANCE_VIEW_ROLES} />}>
                        <Route path="/payments" element={<PaymentsPage />} />
                        <Route path="/expenses" element={<ExpensesPage />} />
                    </Route>
                    <Route
                        element={<ProtectedRoute roles={REPORT_VIEW_ROLES} />}>
                        <Route path="/reports" element={<ReportsPage />} />
                    </Route>

                    <Route
                        path="/products"
                        element={
                            <MasterDataPage key="products" config={PRODUCTS} />
                        }
                    />
                    <Route
                        path="/categories"
                        element={
                            <MasterDataPage
                                key="categories"
                                config={CATEGORIES}
                            />
                        }
                    />
                    <Route
                        path="/units"
                        element={<MasterDataPage key="units" config={UNITS} />}
                    />
                    <Route
                        path="/suppliers"
                        element={
                            <MasterDataPage
                                key="suppliers"
                                config={SUPPLIERS}
                            />
                        }
                    />
                    <Route
                        path="/customers"
                        element={
                            <MasterDataPage
                                key="customers"
                                config={CUSTOMERS}
                            />
                        }
                    />
                </Route>
            </Route>

            <Route element={<ProtectedRoute roles={INVOICE_VIEW_ROLES} />}>
                <Route
                    path="/invoices/:id/print"
                    element={<InvoicePrintPage />}
                />
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
