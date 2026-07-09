import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "./nav-items"
import type { UserRole } from "@/types/database.types"

export function Sidebar({ role, className }: { role: UserRole; className?: string }) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col bg-[#2563eb] text-white",
        className
      )}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#2563eb]">
          LRC
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Volunteer System</p>
          <p className="text-[0.68rem] text-white/70">Language Resource Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-[0.83rem] font-medium transition-colors duration-150",
                isActive
                  ? "bg-white text-[#2563eb] shadow-sm"
                  : "text-white/85 hover:bg-white/15 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-[#2563eb]" : "text-white/70 group-hover:text-white"
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4">
        <p className="text-[0.68rem] font-medium text-white/70">Designed by Jamal Ilaiwi</p>
      </div>
    </aside>
  )
}
