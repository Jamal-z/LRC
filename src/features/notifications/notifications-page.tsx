import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  FileText,
  MessageSquareText,
  Package,
  Trash2,
  UserX,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  notificationLink,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "./use-notifications"
import { cn } from "@/lib/utils"
import type { NotificationRow } from "@/types/database.types"

const TYPE_META: Record<string, { icon: typeof Bell; tint: string; label: string }> = {
  booth_proposal: {
    icon: Package,
    tint: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    label: "Proposal",
  },
  form_response: {
    icon: FileText,
    tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    label: "Form",
  },
  evaluation_submitted: {
    icon: ClipboardCheck,
    tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    label: "Evaluation",
  },
  event_created: {
    icon: CalendarDays,
    tint: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    label: "Event",
  },
  volunteer_terminated: {
    icon: UserX,
    tint: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    label: "Termination",
  },
  task_assigned: {
    icon: ClipboardCheck,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    label: "Task",
  },
  booth_leader_assigned: {
    icon: Users,
    tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    label: "Assignment",
  },
  department_leader_assigned: {
    icon: Users,
    tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    label: "Assignment",
  },
  interview_accepted: {
    icon: MessageSquareText,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    label: "Interview",
  },
}

const FALLBACK_META = {
  icon: Bell,
  tint: "bg-muted text-muted-foreground",
  label: "Update",
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsPage() {
  const { profile } = useAuth()
  const { data: notifications = [], isLoading } = useNotifications(profile?.id)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const deleteNotification = useDeleteNotification()

  const [filter, setFilter] = useState<"all" | "unread">("all")

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter]
  )

  function NotificationRowItem({ notification }: { notification: NotificationRow }) {
    const meta = TYPE_META[notification.type] ?? FALLBACK_META
    const Icon = meta.icon
    const href = notificationLink(notification)

    const body = (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4 transition-colors",
          notification.is_read
            ? "border-border bg-card"
            : "border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.07]"
        )}
      >
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{notification.title}</p>
            <Badge variant="outline" className="text-[0.65rem]">
              {meta.label}
            </Badge>
            {!notification.is_read && <span className="size-2 rounded-full bg-primary" />}
          </div>
          {notification.message && (
            <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground/80">
            {relativeTime(notification.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 gap-1" onClick={(e) => e.preventDefault()}>
          {!notification.is_read && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Mark as read"
              title="Mark as read"
              onClick={() => markRead.mutate(notification.id)}
            >
              <CheckCheck className="size-4" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete notification"
            onClick={() => deleteNotification.mutate(notification.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    )

    if (!href) return body
    return (
      <Link
        to={href}
        onClick={() => !notification.is_read && markRead.mutate(notification.id)}
        className="block"
      >
        {body}
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread · everything happening across the center`
              : "You're all caught up"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter((v as "all" | "unread") ?? "all")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            disabled={!unreadCount || markAllRead.isPending}
            onClick={() =>
              profile &&
              markAllRead.mutate(profile.id, {
                onSuccess: () => toast.success("All marked as read"),
              })
            }
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title={filter === "unread" ? "Nothing unread" : "No notifications yet"}
              description="Evaluations, booth proposals, form responses and new events will show up here."
              icon={Bell}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((notification) => (
            <NotificationRowItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  )
}
