import { Link } from "react-router-dom"
import {
  Users,
  UserPlus,
  CalendarPlus,
  CalendarDays,
  KanbanSquare,
  ClipboardCheck,
  UploadCloud,
  AlertTriangle,
  UserCheck,
} from "lucide-react"
import { useDashboardData } from "./use-dashboard-data"
import { DepartmentCarousel } from "./department-carousel"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useAuth } from "@/features/auth/auth-context"
import { ROLE_LABELS } from "@/lib/constants"

const QUICK_ACTIONS = [
  { label: "Add Volunteer", to: "/volunteers", icon: UserPlus },
  { label: "Create Event", to: "/events", icon: CalendarPlus },
  { label: "Create Task", to: "/tasks", icon: KanbanSquare },
  { label: "Import Volunteers", to: "/import", icon: UploadCloud },
  { label: "Add Evaluation", to: "/evaluations/monthly", icon: ClipboardCheck },
]

export function DashboardPage() {
  const { profile } = useAuth()
  const { data, isLoading, isError } = useDashboardData()

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
            Couldn't load live data yet — connect your Supabase project (.env) to see real numbers here.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Volunteers" value={data?.totalVolunteers ?? 0} icon={Users} isLoading={isLoading} />
        <StatCard label="Active Volunteers" value={data?.activeVolunteers ?? 0} icon={UserCheck} isLoading={isLoading} />
        <StatCard label="Upcoming Events" value={data?.upcomingEvents.length ?? 0} icon={CalendarDays} isLoading={isLoading} />
        <StatCard label="Open Tasks" value={data?.openTasksCount ?? 0} icon={KanbanSquare} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Volunteers by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.volunteersByDepartment.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.volunteersByDepartment} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No volunteers yet" description="Import volunteers or add one to see the breakdown here." icon={Users} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.upcomingEvents.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link to={`/events/${event.id}`} className="text-sm font-medium text-foreground hover:underline">
                        {event.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">{event.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No upcoming events" description="Planned events will show up here." icon={CalendarDays} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.overdueTasks.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.overdueTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" />
                      {task.priority}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing overdue" description="Great! No overdue tasks right now." icon={KanbanSquare} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
