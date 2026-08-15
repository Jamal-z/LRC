import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "./auth-context"
import { PendingApprovalPage } from "./pending-approval-page"

export function ProtectedRoute() {
  const { session, profile, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // signed in, but an admin hasn't approved the account yet
  if (profile && !profile.is_active) {
    return <PendingApprovalPage />
  }

  return <Outlet />
}
