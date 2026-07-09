import { Outlet } from "react-router-dom"
import { useAuth } from "@/features/auth/auth-context"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AppLayout() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div className="flex h-svh bg-gradient-to-br from-sky-50/80 via-background to-blue-50/50 dark:from-background dark:via-background dark:to-background">
      <Sidebar role={profile.role} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
