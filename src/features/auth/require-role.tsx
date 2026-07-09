import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "./auth-context"
import type { UserRole } from "@/types/database.types"

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { profile } = useAuth()

  if (!profile) return null
  if (!roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
