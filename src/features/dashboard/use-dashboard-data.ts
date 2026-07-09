import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface DepartmentCount {
  department: string
  count: number
}

export interface UpcomingEvent {
  id: string
  name: string
  date: string
  location: string | null
  status: string
}

export interface OverdueTask {
  id: string
  title: string
  due_date: string | null
  priority: string
}

export interface DashboardData {
  totalVolunteers: number
  activeVolunteers: number
  inactiveVolunteers: number
  newVolunteers: number
  needsFollowUp: number
  volunteersByDepartment: DepartmentCount[]
  upcomingEvents: UpcomingEvent[]
  openTasksCount: number
  overdueTasks: OverdueTask[]
  monthlyEvaluationsThisMonth: number
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const today = new Date().toISOString().slice(0, 10)
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()

      const [
        volunteersRes,
        upcomingEventsRes,
        openTasksRes,
        overdueTasksRes,
        monthlyEvalRes,
      ] = await Promise.all([
        supabase.from("volunteers").select("status, primary_department_id, departments(name)"),
        supabase
          .from("events")
          .select("id, name, date, location, status")
          .gte("date", today)
          .in("status", ["planned", "in_progress"])
          .order("date", { ascending: true })
          .limit(5),
        supabase.from("tasks").select("id", { count: "exact", head: true }).not("status", "in", "(done,cancelled)"),
        supabase
          .from("tasks")
          .select("id, title, due_date, priority")
          .lt("due_date", today)
          .not("status", "in", "(done,cancelled)")
          .order("due_date", { ascending: true })
          .limit(5),
        supabase
          .from("monthly_evaluations")
          .select("id", { count: "exact", head: true })
          .eq("month", month)
          .eq("year", year),
      ])

      const volunteers = (volunteersRes.data ?? []) as unknown as {
        status: string
        departments: { name: string } | null
      }[]
      const byDept = new Map<string, number>()
      for (const v of volunteers) {
        const name = v.departments?.name ?? "Unassigned"
        byDept.set(name, (byDept.get(name) ?? 0) + 1)
      }

      return {
        totalVolunteers: volunteers.length,
        activeVolunteers: volunteers.filter((v) => v.status === "active").length,
        inactiveVolunteers: volunteers.filter((v) => v.status === "inactive").length,
        newVolunteers: volunteers.filter((v) => v.status === "new").length,
        needsFollowUp: volunteers.filter((v) => v.status === "needs_follow_up").length,
        volunteersByDepartment: Array.from(byDept.entries()).map(([department, count]) => ({ department, count })),
        upcomingEvents: upcomingEventsRes.data ?? [],
        openTasksCount: openTasksRes.count ?? 0,
        overdueTasks: overdueTasksRes.data ?? [],
        monthlyEvaluationsThisMonth: monthlyEvalRes.count ?? 0,
      }
    },
  })
}
