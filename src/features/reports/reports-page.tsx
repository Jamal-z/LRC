import { useQuery } from "@tanstack/react-query"
import { BarChart3, Download } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { EmptyState } from "@/components/shared/empty-state"
import { exportToExcel, type ExportColumn } from "@/lib/export"
import { VOLUNTEER_STATUS_LABELS } from "@/lib/constants"
import type { VolunteerStatus } from "@/types/database.types"

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "#94a3b8"]

interface ReportsData {
  volunteersByDepartment: { department: string; total: number; active: number; inactive: number }[]
  volunteersByStatus: { status: string; count: number }[]
  eventReport: {
    id: string
    name: string
    date: string
    status: string
    participants: number
    booths: number
    hours: number
  }[]
  volunteerHours: { volunteer: string; hours: number; events: number }[]
  evalReport: {
    event: string
    count: number
    avgPerformance: number | null
    recommended: number
    potentialLeaders: number
  }[]
  taskReport: { open: number; overdue: number; completed: number; byDepartment: { department: string; open: number; done: number }[] }
}

function useReportsData() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async (): Promise<ReportsData> => {
      const today = new Date().toISOString().slice(0, 10)
      const [volDeptRes, volunteersRes, eventsRes, participantsRes, monthlyRes, tasksRes] =
        await Promise.all([
          supabase
            .from("volunteer_departments")
            .select("department_id, departments (name), volunteers (id, status)"),
          supabase.from("volunteers").select("id, full_name, status"),
          supabase
            .from("events")
            .select("id, name, date, status, event_booths (id), event_participants (id, total_hours)"),
          supabase
            .from("event_participants")
            .select("volunteer_id, total_hours, volunteers (full_name)"),
          supabase
            .from("event_evaluations")
            .select("performance_rating, recommend_for_future_events, potential_future_booth_leader, events (name)"),
          supabase.from("tasks").select("id, status, due_date, department_id, departments (name)"),
        ])

      // volunteers by department
      const deptMap = new Map<string, { total: number; active: number; inactive: number }>()
      for (const row of (volDeptRes.data ?? []) as unknown as {
        departments: { name: string } | null
        volunteers: { status: string } | null
      }[]) {
        if (!row.departments || !row.volunteers) continue
        const entry = deptMap.get(row.departments.name) ?? { total: 0, active: 0, inactive: 0 }
        entry.total++
        if (row.volunteers.status === "active") entry.active++
        if (row.volunteers.status === "inactive") entry.inactive++
        deptMap.set(row.departments.name, entry)
      }

      // volunteers by status
      const statusMap = new Map<string, number>()
      for (const volunteer of volunteersRes.data ?? []) {
        statusMap.set(volunteer.status, (statusMap.get(volunteer.status) ?? 0) + 1)
      }

      // events
      const eventReport = ((eventsRes.data ?? []) as unknown as {
        id: string
        name: string
        date: string
        status: string
        event_booths: { id: string }[]
        event_participants: { id: string; total_hours: number }[]
      }[]).map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        status: event.status,
        participants: event.event_participants.length,
        booths: event.event_booths.length,
        hours: event.event_participants.reduce((sum, p) => sum + (p.total_hours ?? 0), 0),
      }))

      // volunteer hours
      const hoursMap = new Map<string, { hours: number; events: number }>()
      for (const row of (participantsRes.data ?? []) as unknown as {
        total_hours: number
        volunteers: { full_name: string } | null
      }[]) {
        if (!row.volunteers) continue
        const entry = hoursMap.get(row.volunteers.full_name) ?? { hours: 0, events: 0 }
        entry.hours += row.total_hours ?? 0
        entry.events++
        hoursMap.set(row.volunteers.full_name, entry)
      }

      // event evaluations, grouped by event
      const evalMap = new Map<
        string,
        { count: number; ratingSum: number; ratingCount: number; recommended: number; potentialLeaders: number }
      >()
      for (const row of (monthlyRes.data ?? []) as unknown as {
        performance_rating: number | null
        recommend_for_future_events: boolean | null
        potential_future_booth_leader: boolean | null
        events: { name: string } | null
      }[]) {
        const name = row.events?.name ?? "—"
        const entry =
          evalMap.get(name) ?? { count: 0, ratingSum: 0, ratingCount: 0, recommended: 0, potentialLeaders: 0 }
        entry.count++
        if (row.performance_rating != null) {
          entry.ratingSum += row.performance_rating
          entry.ratingCount++
        }
        if (row.recommend_for_future_events) entry.recommended++
        if (row.potential_future_booth_leader) entry.potentialLeaders++
        evalMap.set(name, entry)
      }

      // tasks
      const tasks = (tasksRes.data ?? []) as unknown as {
        status: string
        due_date: string | null
        departments: { name: string } | null
      }[]
      const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length
      const overdue = tasks.filter(
        (t) => !["done", "cancelled"].includes(t.status) && t.due_date && t.due_date < today
      ).length
      const completed = tasks.filter((t) => t.status === "done").length
      const taskDeptMap = new Map<string, { open: number; done: number }>()
      for (const task of tasks) {
        const name = task.departments?.name ?? "No department"
        const entry = taskDeptMap.get(name) ?? { open: 0, done: 0 }
        if (task.status === "done") entry.done++
        else if (task.status !== "cancelled") entry.open++
        taskDeptMap.set(name, entry)
      }

      return {
        volunteersByDepartment: Array.from(deptMap.entries()).map(([department, counts]) => ({
          department,
          ...counts,
        })),
        volunteersByStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
          status: VOLUNTEER_STATUS_LABELS[status as VolunteerStatus] ?? status,
          count,
        })),
        eventReport,
        volunteerHours: Array.from(hoursMap.entries())
          .map(([volunteer, entry]) => ({ volunteer, ...entry }))
          .sort((a, b) => b.hours - a.hours),
        evalReport: Array.from(evalMap.entries()).map(([event, entry]) => ({
          event,
          count: entry.count,
          avgPerformance: entry.ratingCount
            ? Number((entry.ratingSum / entry.ratingCount).toFixed(1))
            : null,
          recommended: entry.recommended,
          potentialLeaders: entry.potentialLeaders,
        })),
        taskReport: {
          open,
          overdue,
          completed,
          byDepartment: Array.from(taskDeptMap.entries()).map(([department, counts]) => ({
            department,
            ...counts,
          })),
        },
      }
    },
  })
}

export function ReportsPage() {
  const { data, isLoading } = useReportsData()

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const deptColumns: ExportColumn<(typeof data.volunteersByDepartment)[number]>[] = [
    { header: "Department", value: (r) => r.department },
    { header: "Total Volunteers", value: (r) => r.total },
    { header: "Active", value: (r) => r.active },
    { header: "Inactive", value: (r) => r.inactive },
  ]
  const eventColumns: ExportColumn<(typeof data.eventReport)[number]>[] = [
    { header: "Event", value: (r) => r.name },
    { header: "Date", value: (r) => r.date },
    { header: "Status", value: (r) => r.status },
    { header: "Participants", value: (r) => r.participants },
    { header: "Booths", value: (r) => r.booths },
    { header: "Total Hours", value: (r) => r.hours },
  ]
  const hoursColumns: ExportColumn<(typeof data.volunteerHours)[number]>[] = [
    { header: "Volunteer", value: (r) => r.volunteer },
    { header: "Total Hours", value: (r) => r.hours },
    { header: "Events", value: (r) => r.events },
  ]
  const evalColumns: ExportColumn<(typeof data.evalReport)[number]>[] = [
    { header: "Event", value: (r) => r.event },
    { header: "Evaluations", value: (r) => r.count },
    { header: "Avg Performance", value: (r) => r.avgPerformance },
    { header: "Recommended for Future Events", value: (r) => r.recommended },
    { header: "Potential Booth Leaders", value: (r) => r.potentialLeaders },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Live reports across volunteers, events, hours, evaluations and tasks.
        </p>
      </div>

      <Tabs defaultValue="volunteers">
        <TabsList className="flex-wrap">
          <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          <TabsTrigger value="events">Events & Participation</TabsTrigger>
          <TabsTrigger value="hours">Volunteer Hours</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        {/* Volunteers */}
        <TabsContent value="volunteers">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">By department</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportToExcel(data.volunteersByDepartment, deptColumns, "volunteers-by-department")}
                >
                  <Download className="size-3.5" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {data.volunteersByDepartment.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.volunteersByDepartment} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="department" width={130} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="active" stackId="a" fill="var(--chart-1)" name="Active" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="inactive" stackId="a" fill="var(--chart-3)" name="Inactive" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No volunteer data yet" icon={BarChart3} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By status</CardTitle>
              </CardHeader>
              <CardContent>
                {data.volunteersByStatus.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.volunteersByStatus}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {data.volunteersByStatus.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No volunteer data yet" icon={BarChart3} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Event participation</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToExcel(data.eventReport, eventColumns, "event-participation")}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.eventReport.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Booths</TableHead>
                      <TableHead>Participants</TableHead>
                      <TableHead>Total hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.eventReport.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.name}</TableCell>
                        <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{event.status}</Badge>
                        </TableCell>
                        <TableCell>{event.booths}</TableCell>
                        <TableCell>{event.participants}</TableCell>
                        <TableCell>{event.hours.toFixed(1)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No events yet" icon={BarChart3} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Hours per volunteer</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToExcel(data.volunteerHours, hoursColumns, "volunteer-hours")}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.volunteerHours.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Volunteer</TableHead>
                      <TableHead>Events participated</TableHead>
                      <TableHead>Total hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.volunteerHours.map((row) => (
                      <TableRow key={row.volunteer}>
                        <TableCell className="font-medium">{row.volunteer}</TableCell>
                        <TableCell>{row.events}</TableCell>
                        <TableCell>{row.hours.toFixed(1)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  title="No hours tracked yet"
                  description="Hours come from event participation start/end times."
                  icon={BarChart3}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluations */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Event evaluations</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToExcel(data.evalReport, evalColumns, "evaluation-report")}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.evalReport.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Evaluations</TableHead>
                      <TableHead>Avg performance</TableHead>
                      <TableHead>Recommended again</TableHead>
                      <TableHead>Potential booth leaders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.evalReport.map((row) => (
                      <TableRow key={row.event}>
                        <TableCell className="font-medium">{row.event}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>{row.avgPerformance ?? "—"}</TableCell>
                        <TableCell>{row.recommended}</TableCell>
                        <TableCell>{row.potentialLeaders}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No evaluations yet" icon={BarChart3} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Open tasks</p>
                <p className="mt-1 text-3xl font-semibold text-foreground">{data.taskReport.open}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="mt-1 text-3xl font-semibold text-destructive">{data.taskReport.overdue}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="mt-1 text-3xl font-semibold text-emerald-600">{data.taskReport.completed}</p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Tasks by department</CardTitle>
            </CardHeader>
            <CardContent>
              {data.taskReport.byDepartment.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.taskReport.byDepartment}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="open" fill="var(--chart-2)" name="Open" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="done" fill="var(--chart-1)" name="Done" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="No tasks yet" icon={BarChart3} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
