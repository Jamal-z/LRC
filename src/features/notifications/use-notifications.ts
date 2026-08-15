import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { NotificationRow } from "@/types/database.types"

export function useNotifications(userId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ["notifications", userId, limit],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

/** Where clicking a notification should take you. */
export function notificationLink(notification: NotificationRow): string | null {
  switch (notification.related_entity_type) {
    case "event":
      return `/events/${notification.related_entity_id}`
    case "booth":
    case "booth_proposal":
      return notification.related_entity_id ? "/events" : null
    case "form":
      return `/forms/${notification.related_entity_id}/responses`
    case "volunteer":
      return `/volunteers/${notification.related_entity_id}`
    case "department":
      return `/departments/${notification.related_entity_id}`
    case "task":
      return "/tasks"
    case "event_evaluation":
    case "monthly_evaluation":
      return "/evaluations"
    case "interview":
      return "/interviews"
    case "user":
      return "/users"
    default:
      return null
  }
}
