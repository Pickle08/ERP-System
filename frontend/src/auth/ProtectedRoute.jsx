import { Navigate, Outlet, useLocation } from "react-router-dom";
import Spinner from "../components/Spinner";
import { useAuth } from "./useAuth";

// <ProtectedRoute />                      -> wajib login
// <ProtectedRoute roles={['admin']} />    -> wajib login DAN role termasuk daftar
export default function ProtectedRoute({ roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!user)
        return <Navigate to="/login" replace state={{ from: location }} />;
    if (roles && !roles.includes(user.role))
        return <Navigate to="/forbidden" replace />;

    return <Outlet />;
}
