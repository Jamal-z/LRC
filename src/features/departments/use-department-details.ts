import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DepartmentRow } from "@/types/database.types"

export interface DepartmentSummary extends DepartmentRow {
  leaders: { id: string; user_id: string; profiles: { id: string; full_name: string; email: string } }[]
  volunteerCount: number
  activeCount: number
  inactiveCount: number
}

export function useDepartmentSummaries() {
  return useQuery({
    queryKey: ["department-summaries"],
    queryFn: async (): Promise<DepartmentSummary[]> => {
      const [deptRes, leadersRes, volDeptRes] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase
          .from("department_leaders")
          .select("id, user_id, department_id, profiles:user_id (id, full_name, email)"),
        supabase
          .from("volunteer_departments")
          .select("department_id, volunteers!inner (id, status)")
          .neq("volunteers.status", "archived"),
      ])
      if (deptRes.error) throw deptRes.error

      const leadersByDept = new Map<string, DepartmentSummary["leaders"]>()
      for (const leader of (leadersRes.data ?? []) as unknown as {
        id: string
        user_id: string
        department_id: string
        profiles: { id: string; full_name: string; email: string }
      }[]) {
        const list = leadersByDept.get(leader.department_id) ?? []
        list.push(leader)
        leadersByDept.set(leader.department_id, list)
      }

      const countsByDept = new Map<string, { total: number; active: number; inactive: number }>()
      for (const vd of (volDeptRes.data ?? []) as unknown as {
        department_id: string
        volunteers: { id: string; status: string } | null
      }[]) {
        if (!vd.volunteers) continue
        const counts = countsByDept.get(vd.department_id) ?? { total: 0, active: 0, inactive: 0 }
        counts.total++
        if (vd.volunteers.status === "active") counts.active++
        if (vd.volunteers.status === "inactive") counts.inactive++
        countsByDept.set(vd.department_id, counts)
      }

      return deptRes.data.map((dept) => ({
        ...dept,
        leaders: leadersByDept.get(dept.id) ?? [],
        volunteerCount: countsByDept.get(dept.id)?.total ?? 0,
        activeCount: countsByDept.get(dept.id)?.active ?? 0,
        inactiveCount: countsByDept.get(dept.id)?.inactive ?? 0,
      }))
    },
  })
}

export function useDepartmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["departments", id, "detail"],
    queryFn: async () => {
      const [deptRes, leadersRes, volunteersRes, tasksRes, eventsRes] = await Promise.all([
        supabase.from("departments").select("*").eq("id", id!).single(),
        supabase
          .from("department_leaders")
          .select("id, user_id, profiles:user_id (id, full_name, email, avatar_url)")
          .eq("department_id", id!),
        supabase
          .from("volunteer_departments")
          .select("is_primary, volunteers!inner (id, full_name, status, phone, email, photo_url)")
          .eq("department_id", id!)
          .neq("volunteers.status", "archived"),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .eq("department_id", id!)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("event_departments")
          .select("events (id, name, date, status)")
          .eq("department_id", id!),
      ])
      if (deptRes.error) throw deptRes.error

      return {
        department: deptRes.data,
        leaders: (leadersRes.data ?? []) as unknown as {
          id: string
          user_id: string
          profiles: { id: string; full_name: string; email: string; avatar_url: string | null }
        }[],
        volunteers: (volunteersRes.data ?? []) as unknown as {
          is_primary: boolean
          volunteers: {
            id: string
            full_name: string
            status: string
            phone: string | null
            email: string | null
            photo_url: string | null
          } | null
        }[],
        tasks: tasksRes.data ?? [],
        events: ((eventsRes.data ?? []) as unknown as {
          events: { id: string; name: string; date: string; status: string } | null
        }[])
          .map((e) => e.events)
          .filter(Boolean),
      }
    },
    enabled: !!id,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["profiles", "admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("is_active", true)
        .order("full_name")
      if (error) throw error
      return data
    },
  })
}

export function useAddDepartmentLeader() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ departmentId, userId }: { departmentId: string; userId: string }) => {
      const { error } = await supabase
        .from("department_leaders")
        .insert({ department_id: departmentId, user_id: userId })
      if (error) throw error
    },
    onSuccess: (_, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["departments", departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
    },
  })
}

export function useRemoveDepartmentLeader() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leaderId }: { leaderId: string; departmentId: string }) => {
      const { error } = await supabase.from("department_leaders").delete().eq("id", leaderId)
      if (error) throw error
    },
    onSuccess: (_, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["departments", departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
    },
  })
}
