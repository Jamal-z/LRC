import { Link } from "react-router-dom"
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Images,
  KanbanSquare,
  Sparkles,
  Star,
  Timer,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react"
import { useDashboardData } from "./use-dashboard-data"
import { DepartmentCarousel } from "./department-carousel"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/auth-context"
import { ROLE_LABELS } from "@/lib/constants"

const QUICK_ACTIONS = [
  { label: "Add Volunteer", to: "/volunteers", icon: UserPlus },
  { label: "Create Event", to: "/events", icon: CalendarPlus },
  { label: "Evaluate", to: "/evaluations", icon: ClipboardCheck },
  { label: "Create Task", to: "/tasks", icon: KanbanSquare },
  { label: "Import Volunteers", to: "/import", icon: UploadCloud },
]

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

const MEDAL_STYLES = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
]

export function DashboardPage() {
  const { profile } = useAuth()
  const { data, isLoading, isError } = useDashboardData()

  const maxDeptCount = Math.max(1, ...(data?.volunteersByDepartment.map((d) => d.count) ?? [1]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back{profile ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile ? ROLE_LABELS[profile.role] : ""} · here's what's happening across LRC today.
        </p>
      </div>

      <DepartmentCarousel />

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Couldn't load live data — check your connection and refresh.
          </CardContent>
        </Card>
      )}

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Volunteers"
          value={data?.totalVolunteers ?? 0}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          label="Total shifts"
          value={data?.totalShifts ?? 0}
          icon={Timer}
          isLoading={isLoading}
        />
        <StatCard
          label="Events this year"
          value={data?.eventsThisYear ?? 0}
          icon={CalendarDays}
          isLoading={isLoading}
        />
        <StatCard
          label="Open tasks"
          value={data?.openTasksCount ?? 0}
          icon={KanbanSquare}
          isLoading={isLoading}
        />
      </div>

      {/* per-team breakdown + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Volunteers by team</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.volunteersByDepartment.length ? (
              <div className="flex flex-col gap-3">
                {data.volunteersByDepartment.map((dept) => (
                  <Link
                    key={dept.id}
                    to={`/departments/${dept.id}`}
                    className="group flex items-center gap-3"
                  >
                    <span className="w-44 shrink-0 truncate text-sm font-medium text-foreground group-hover:underline">
                      {dept.department}
                    </span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-muted">
                      <div
                        className="flex h-full items-center rounded-lg bg-gradient-to-r from-blue-600 to-sky-400 px-2 transition-all"
                        style={{ width: `${Math.max(6, (dept.count / maxDeptCount) * 100)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{dept.count}</span>
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs text-emerald-600 dark:text-emerald-400">
                      {dept.active} active
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No volunteers yet"
                description="Import volunteers or add one to see the breakdown here."
                icon={Users}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.to}
                variant="outline"
                className="justify-start gap-2"
                render={<Link to={action.to} />}
              >
                <action.icon className="size-4" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* top rated + upcoming events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-amber-500" />
              Top rated volunteers
            </CardTitle>
            <Button size="xs" variant="ghost" render={<Link to="/reports" />}>
              All reports
            </Button>
          </CardHeader>
          <CardContent>
            {data?.topVolunteers.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.topVolunteers.map((volunteer, index) => (
                  <li key={volunteer.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        MEDAL_STYLES[index] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <Avatar className="size-9">
                      {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                      <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                        {initials(volunteer.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/volunteers/${volunteer.id}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {volunteer.full_name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {volunteer.department ?? "—"} · {volunteer.shifts} shifts
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {volunteer.average.toFixed(1)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No evaluations yet"
                description="Once leaders evaluate volunteers after an event, the top performers show up here."
                icon={Star}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming events</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.upcomingEvents.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <span className="text-[0.6rem] font-semibold uppercase leading-none">
                        {new Date(event.date).toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-tight">
                        {new Date(event.date).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/events/${event.id}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {event.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.location ?? "—"}
                      </p>
                    </div>
                    <Badge variant="secondary">{event.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No upcoming events"
                description="Planned events will show up here."
                icon={CalendarDays}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* memories */}
      {data?.memories.length ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Images className="size-4 text-primary" />
              Memories
            </CardTitle>
            <p className="text-xs text-muted-foreground">Random moments from our events</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {data.memories.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-xl"
                >
                  <img
                    src={photo.url}
                    alt={photo.eventName ?? "Event memory"}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {photo.eventName && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pt-6 pb-1.5 text-[0.65rem] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {photo.eventName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* overdue tasks */}
      {data?.overdueTasks.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" />
              Overdue tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {data.overdueTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Badge variant="destructive">{task.priority}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
