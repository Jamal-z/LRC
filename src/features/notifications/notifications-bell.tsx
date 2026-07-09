import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NotificationRow } from "@/types/database.types"
import { cn } from "@/lib/utils"

export function NotificationsBell() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!profile,
    refetchInterval: 60_000,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", profile!.id)
        .eq("is_read", false)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Notifications" className="relative" />}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "border-b border-border px-3 py-2.5 last:border-0",
                  !notification.is_read && "bg-accent/40"
                )}
              >
                <p className="text-sm font-medium text-foreground">{notification.title}</p>
                {notification.message && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
                )}
                <p className="mt-0.5 text-[0.68rem] text-muted-foreground/70">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
