import { Navigate } from "react-router-dom";
import { getRole, type Role } from "../auth";

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: Role;
}) {
  const role = getRole();

  // Not logged in
  if (!role) {
    return <Navigate to="/" replace />;
  }

  // Logged in but wrong role
  if (role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
