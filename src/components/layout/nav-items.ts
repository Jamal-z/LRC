import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  UserX,
  Building2,
  CalendarDays,
  KanbanSquare,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  UploadCloud,
  Settings,
  FileText,
} from "lucide-react"
import type { UserRole } from "@/types/database.types"

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles: UserRole[]
}

const ALL_STAFF: UserRole[] = ["super_admin", "admin", "department_leader", "booth_leader"]
const MANAGERS: UserRole[] = ["super_admin", "admin", "department_leader"]
const ADMINS_ONLY: UserRole[] = ["super_admin", "admin"]

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ALL_STAFF },
  { label: "Volunteers", path: "/volunteers", icon: Users, roles: MANAGERS },
  { label: "Departments", path: "/departments", icon: Building2, roles: MANAGERS },
  { label: "Events", path: "/events", icon: CalendarDays, roles: ALL_STAFF },
  { label: "Tasks", path: "/tasks", icon: KanbanSquare, roles: MANAGERS },
  { label: "Evaluations", path: "/evaluations", icon: ClipboardCheck, roles: ALL_STAFF },
  { label: "Reports", path: "/reports", icon: BarChart3, roles: ADMINS_ONLY },
  { label: "Forms", path: "/forms", icon: FileText, roles: ADMINS_ONLY },
  { label: "Terminations", path: "/terminations", icon: UserX, roles: ADMINS_ONLY },
  { label: "Users & Roles", path: "/users", icon: ShieldCheck, roles: ADMINS_ONLY },
  { label: "Import Data", path: "/import", icon: UploadCloud, roles: ADMINS_ONLY },
  { label: "Settings", path: "/settings", icon: Settings, roles: ADMINS_ONLY },
]
