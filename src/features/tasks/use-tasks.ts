import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { TaskPriority, TaskRow, TaskStatus } from "@/types/database.types"

export interface TaskWithDetails extends TaskRow {
  departments: { id: string; name: string } | null
  assignee: { id: string; full_name: string } | null
  volunteer_assignee: { id: string; full_name: string } | null
  events: { id: string; name: string } | null
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<TaskWithDetails[]> => {
      // housekeeping: done/cancelled tasks older than a week are purged so the
      // board doesn't accumulate stale data
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from("tasks")
        .delete()
        .in("status", ["done", "cancelled"])
        .lt("updated_at", weekAgo)

      const { data, error } = await supabase
        .from("tasks")
        .select(
          "*, departments (id, name), assignee:assigned_to_user_id (id, full_name), volunteer_assignee:assigned_to_volunteer_id (id, full_name), events:related_event_id (id, name)"
        )
        .order("board_position")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as TaskWithDetails[]
    },
  })
}

export interface TaskComment {
  id: string
  comment: string
  created_at: string
  profiles: { id: string; full_name: string } | null
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("id, comment, created_at, profiles:user_id (id, full_name)")
        .eq("task_id", taskId!)
        .order("created_at")
      if (error) throw error
      return data as unknown as TaskComment[]
    },
    enabled: !!taskId,
  })
}

export function useAddTaskComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, userId, comment }: { taskId: string; userId: string; comment: string }) => {
      const { error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, user_id: userId, comment })
      if (error) throw error
    },
    onSuccess: (_, { taskId }) =>
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  })
}

export interface SaveTaskInput {
  id?: string
  title: string
  description?: string | null
  department_id?: string | null
  assigned_to_user_id?: string | null
  assigned_to_volunteer_id?: string | null
  created_by?: string | null
  due_date?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  related_event_id?: string | null
}

export function useSaveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveTaskInput) => {
      if (input.id) {
        const { id, ...updates } = input
        const { error } = await supabase.from("tasks").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("tasks").insert(input)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useMoveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId)
      if (error) throw error
    },
    // optimistic update so the card lands instantly
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] })
      const previous = queryClient.getQueryData<TaskWithDetails[]>(["tasks"])
      queryClient.setQueryData<TaskWithDetails[]>(["tasks"], (old) =>
        old?.map((task) => (task.id === taskId ? { ...task, status } : task))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
