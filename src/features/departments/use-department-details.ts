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
        // only the shared columns — phone/email now live in volunteer_private
        supabase
          .from("volunteer_departments")
          .select("is_primary, volunteers!inner (id, full_name, status, photo_url)")
          .eq("department_id", id!)
          .neq("volunteers.status", "archived"),
        supabase
          .from("tasks")
          .select(
            "id, title, description, status, priority, due_date, assigned_to_volunteer_id, volunteers:assigned_to_volunteer_id (id, full_name)"
          )
          .eq("department_id", id!)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_departments")
          .select("events (id, name, date, status)")
          .eq("department_id", id!),
      ])
      if (deptRes.error) throw deptRes.error
      // surface these instead of silently rendering an empty team
      if (volunteersRes.error) throw volunteersRes.error
      if (tasksRes.error) throw tasksRes.error

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
            photo_url: string | null
          } | null
        }[],
        tasks: (tasksRes.data ?? []) as unknown as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          due_date: string | null
          assigned_to_volunteer_id: string | null
          volunteers: { id: string; full_name: string } | null
        }[],
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

/** Events this department joined, with how far its evaluations have got. */
export interface DepartmentEventEvaluation {
  eventId: string
  eventName: string
  eventDate: string
  eventStatus: string
  participantCount: number
  evaluatedCount: number
  averageRating: number | null
  totalShifts: number
}

export function useDepartmentEventEvaluations(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["department-event-evaluations", departmentId],
    queryFn: async (): Promise<DepartmentEventEvaluation[]> => {
      const { data: eventLinks, error: linkError } = await supabase
        .from("event_departments")
        .select("events (id, name, date, status)")
        .eq("department_id", departmentId!)
      if (linkError) throw linkError

      const events = ((eventLinks ?? []) as unknown as {
        events: { id: string; name: string; date: string; status: string } | null
      }[])
        .map((row) => row.events)
        .filter((event): event is { id: string; name: string; date: string; status: string } =>
          Boolean(event)
        )
      if (!events.length) return []

      const eventIds = events.map((event) => event.id)
      const [membersRes, evaluationsRes] = await Promise.all([
        // the team is evaluated as a whole for every event, so the target
        // count is the team's size — not who was registered as a participant
        supabase
          .from("volunteer_departments")
          .select("volunteer_id, volunteers!inner (id, status)")
          .eq("department_id", departmentId!)
          .neq("volunteers.status", "archived"),
        supabase
          .from("event_evaluations")
          .select(
            "event_id, volunteer_id, shifts_count, meeting_attendance_rating, performance_rating, teamwork_rating, communication_rating"
          )
          .in("event_id", eventIds)
          .eq("department_id", departmentId!),
      ])

      const teamSize = (membersRes.data ?? []).length
      const evaluations = (evaluationsRes.data ?? []) as {
        event_id: string
        volunteer_id: string
        shifts_count: number | null
        meeting_attendance_rating: number | null
        performance_rating: number | null
        teamwork_rating: number | null
        communication_rating: number | null
      }[]

      return events
        .map((event) => {
          const eventEvaluations = evaluations.filter((e) => e.event_id === event.id)
          const averages = eventEvaluations
            .map((evaluation) => {
              const scores = [
                evaluation.meeting_attendance_rating,
                evaluation.performance_rating,
                evaluation.teamwork_rating,
                evaluation.communication_rating,
              ].filter((v): v is number => v != null)
              return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
            })
            .filter((v): v is number => v != null)

          return {
            eventId: event.id,
            eventName: event.name,
            eventDate: event.date,
            eventStatus: event.status,
            participantCount: teamSize,
            evaluatedCount: new Set(eventEvaluations.map((e) => e.volunteer_id)).size,
            averageRating: averages.length
              ? averages.reduce((a, b) => a + b, 0) / averages.length
              : null,
            totalShifts: eventEvaluations.reduce((sum, e) => sum + (e.shifts_count ?? 0), 0),
          }
        })
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    },
    enabled: !!departmentId,
  })
}

/** Creates a task for this department, optionally assigned to a volunteer. */
export function useCreateDepartmentTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      departmentId: string
      title: string
      description?: string | null
      assignedVolunteerId?: string | null
      dueDate?: string | null
      priority?: string
      createdBy: string | null
    }) => {
      const { error } = await supabase.from("tasks").insert({
        department_id: input.departmentId,
        title: input.title,
        description: input.description ?? null,
        assigned_to_volunteer_id: input.assignedVolunteerId ?? null,
        due_date: input.dueDate ?? null,
        priority: (input.priority ?? "medium") as never,
        status: "todo" as never,
        created_by: input.createdBy,
      })
      if (error) throw error
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["departments", input.departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string; departmentId: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: status as never })
        .eq("id", taskId)
      if (error) throw error
    },
    onSuccess: (_, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["departments", departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
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

/**
 * Adds existing volunteers to a department as a secondary team.
 * Uses upsert so re-adding someone who is already linked is a no-op instead
 * of failing on the (volunteer_id, department_id) unique constraint.
 */
export function useAddVolunteersToDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      departmentId,
      volunteerIds,
    }: {
      departmentId: string
      volunteerIds: string[]
    }) => {
      const { error } = await supabase.from("volunteer_departments").upsert(
        volunteerIds.map((volunteerId) => ({
          volunteer_id: volunteerId,
          department_id: departmentId,
        })),
        { onConflict: "volunteer_id,department_id", ignoreDuplicates: true }
      )
      if (error) {
        // RLS rejects the row rather than erroring loudly, so translate the
        // common failure into something actionable
        if (error.code === "42501" || /row-level security/i.test(error.message)) {
          throw new Error(
            "You don't have permission to change this team's volunteers. Only admins can do that."
          )
        }
        throw error
      }
    },
    onSuccess: (_, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["departments", departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useRemoveVolunteerFromDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      departmentId,
      volunteerId,
    }: {
      departmentId: string
      volunteerId: string
    }) => {
      const { error } = await supabase
        .from("volunteer_departments")
        .delete()
        .eq("department_id", departmentId)
        .eq("volunteer_id", volunteerId)
        .eq("is_primary", false)
      if (error) throw error
    },
    onSuccess: (_, { departmentId }) => {
      queryClient.invalidateQueries({ queryKey: ["departments", departmentId, "detail"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
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
