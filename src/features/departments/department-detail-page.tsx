import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Check,
  ClipboardCheck,
  Plus,
  Star,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  useAddDepartmentLeader,
  useAddVolunteersToDepartment,
  useAdminUsers,
  useCreateDepartmentTask,
  useDepartmentDetail,
  useDepartmentEventEvaluations,
  useRemoveDepartmentLeader,
  useRemoveVolunteerFromDepartment,
  useUpdateTaskStatus,
} from "./use-department-details"
import { useVolunteers } from "@/features/volunteers/use-volunteers"
import { MONTH_NAMES, useMonthlySummary } from "@/features/evaluations/use-monthly-evaluations"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  ROLE_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  VOLUNTEER_STATUS_BADGE,
  VOLUNTEER_STATUS_LABELS,
} from "@/lib/constants"
import type { TaskPriority, TaskStatus, UserRole, VolunteerStatus } from "@/types/database.types"

const NO_ASSIGNEE = "__unassigned__"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function DepartmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, isLoading } = useDepartmentDetail(id)
  const { data: adminUsers = [] } = useAdminUsers()
  const addLeader = useAddDepartmentLeader()
  const removeLeader = useRemoveDepartmentLeader()

  const [addLeaderOpen, setAddLeaderOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [addVolunteersOpen, setAddVolunteersOpen] = useState(false)
  const [volunteerSearch, setVolunteerSearch] = useState("")
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>([])

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  // Moving volunteers between teams is an admin / committee decision — leaders
  // view their team but don't change its membership.
  const canManageVolunteers = isAdmin

  const { data: allVolunteers = [] } = useVolunteers()
  const { data: departmentEvents = [] } = useDepartmentEventEvaluations(id)
  const { data: monthlySummary } = useMonthlySummary(id)
  const addVolunteers = useAddVolunteersToDepartment()
  const removeVolunteer = useRemoveVolunteerFromDepartment()
  const createTask = useCreateDepartmentTask()
  const updateTaskStatus = useUpdateTaskStatus()

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskAssignee, setTaskAssignee] = useState<string>(NO_ASSIGNEE)
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskPriority, setTaskPriority] = useState("medium")

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        title="Department not found"
        description="It may have been removed, or you don't have access."
        icon={Building2}
      />
    )
  }

  const { department, leaders, volunteers, tasks, events } = data
  const availableUsers = adminUsers.filter(
    (user) => !leaders.some((l) => l.user_id === user.id)
  )

  const memberIds = new Set(volunteers.map((vd) => vd.volunteers?.id).filter(Boolean))
  const availableVolunteers = allVolunteers.filter((volunteer) => {
    if (memberIds.has(volunteer.id)) return false
    const term = volunteerSearch.trim().toLowerCase()
    return !term || volunteer.full_name.toLowerCase().includes(term)
  })

  async function handleAddLeader() {
    if (!selectedUserId || !id) return
    try {
      await addLeader.mutateAsync({ departmentId: id, userId: selectedUserId })
      toast.success("Leader added")
      setAddLeaderOpen(false)
      setSelectedUserId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add leader")
    }
  }

  async function handleRemoveLeader(leaderId: string, name: string) {
    if (!id) return
    try {
      await removeLeader.mutateAsync({ leaderId, departmentId: id })
      toast.success(`${name} removed from leaders`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove leader")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/departments" />}>
          <ArrowLeft className="size-4" />
          Back to departments
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Building2 className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {department.name}
              </h1>
              {department.description && (
                <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                  {department.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {volunteers.length} volunteers
                </span>
                <Badge variant={department.requires_monthly_evaluation ? "secondary" : "outline"}>
                  {department.requires_monthly_evaluation
                    ? "Monthly evaluation"
                    : "Event-based evaluation"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Department leaders</CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddLeaderOpen(true)}>
              <Plus className="size-4" />
              Add leader
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {leaders.length ? (
            <ul className="flex flex-wrap gap-3">
              {leaders.map((leader) => (
                <li
                  key={leader.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <Avatar className="size-8">
                    {leader.profiles.avatar_url && <AvatarImage src={leader.profiles.avatar_url} />}
                    <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                      {initials(leader.profiles.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {leader.profiles.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{leader.profiles.email}</p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove leader"
                      onClick={() => handleRemoveLeader(leader.id, leader.profiles.full_name)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No leaders assigned"
              description={
                department.name === "Field Volunteering"
                  ? "Field Volunteering has no permanent leader by default."
                  : "Add a leader to let them manage this department."
              }
            />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="volunteers">
        <TabsList>
          <TabsTrigger value="volunteers">Volunteers ({volunteers.length})</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations ({departmentEvents.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="volunteers">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Team volunteers ({volunteers.length})</CardTitle>
              {canManageVolunteers && (
                <Button size="sm" onClick={() => setAddVolunteersOpen(true)}>
                  <UserPlus className="size-4" />
                  Add volunteers
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {volunteers.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {volunteers
                    .filter((vd) => vd.volunteers)
                    .map((vd) => (
                      <div
                        key={vd.volunteers!.id}
                        className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-shadow hover:shadow-md"
                        onClick={() => navigate(`/volunteers/${vd.volunteers!.id}`)}
                      >
                        <Avatar className="size-14">
                          {vd.volunteers!.photo_url && (
                            <AvatarImage src={vd.volunteers!.photo_url} />
                          )}
                          <AvatarFallback className="bg-accent text-accent-foreground">
                            {initials(vd.volunteers!.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium text-foreground">
                          {vd.volunteers!.full_name}
                        </p>
                        <div className="flex flex-wrap justify-center gap-1">
                          {isAdmin && (
                            <Badge
                              className={
                                VOLUNTEER_STATUS_BADGE[vd.volunteers!.status as VolunteerStatus]
                              }
                            >
                              {VOLUNTEER_STATUS_LABELS[vd.volunteers!.status as VolunteerStatus]}
                            </Badge>
                          )}
                          <Badge variant={vd.is_primary ? "secondary" : "outline"} className="text-xs">
                            {vd.is_primary ? "Primary" : "Secondary"}
                          </Badge>
                        </div>
                        {canManageVolunteers && !vd.is_primary && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remove from team"
                            className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeVolunteer.mutate(
                                { departmentId: id!, volunteerId: vd.volunteers!.id },
                                {
                                  onSuccess: () => toast.success("Removed from team"),
                                  onError: (error) => toast.error(error.message),
                                }
                              )
                            }}
                          >
                            <UserMinus className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState
                  title="No volunteers in this team"
                  description={
                    canManageVolunteers
                      ? "Use “Add volunteers” to build the team."
                      : "Volunteers assigned to this team will show here."
                  }
                  icon={Users}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          {department.requires_monthly_evaluation && (
            <Card className="mb-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <CalendarRange className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Monthly evaluation</p>
                    <p className="text-sm text-muted-foreground">
                      This team also works between events — rate each member month by month.
                    </p>
                    {monthlySummary?.periods[0] && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last: {MONTH_NAMES[monthlySummary.periods[0].month - 1]}{" "}
                        {monthlySummary.periods[0].year} ·{" "}
                        {monthlySummary.periods[0].evaluatedCount}/{monthlySummary.teamSize}{" "}
                        evaluated
                        {monthlySummary.periods[0].average != null &&
                          ` · avg ${monthlySummary.periods[0].average.toFixed(1)}`}
                      </p>
                    )}
                  </div>
                </div>
                <Button render={<Link to={`/departments/${id}/monthly`} />}>
                  <CalendarRange className="size-4" />
                  Open monthly evaluation
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event evaluations</CardTitle>
              <CardDescription>
                Every event this team joined, and how far its evaluations have got.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {departmentEvents.length ? (
                <div className="flex flex-col gap-3">
                  {departmentEvents.map((entry) => {
                    const percent =
                      entry.participantCount > 0
                        ? Math.min(
                            100,
                            Math.round((entry.evaluatedCount / entry.participantCount) * 100)
                          )
                        : 0
                    return (
                      <div
                        key={entry.eventId}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                      >
                        <div className="min-w-48">
                          <p className="font-medium text-foreground">{entry.eventName}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{new Date(entry.eventDate).toLocaleDateString()}</span>
                            <span>{entry.participantCount} volunteers</span>
                            <span>{entry.totalShifts} shifts</span>
                            {entry.averageRating != null && (
                              <span className="inline-flex items-center gap-1">
                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                {entry.averageRating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="w-36">
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>Evaluated</span>
                              <span>
                                {entry.evaluatedCount}/{entry.participantCount}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={entry.participantCount === 0}
                            render={
                              <Link to={`/evaluations/${entry.eventId}/department/${id}`} />
                            }
                          >
                            <ClipboardCheck className="size-4" />
                            Evaluate
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No events yet"
                  description="Once this team joins an event, you can evaluate its volunteers here."
                  icon={ClipboardCheck}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Team tasks</CardTitle>
                <CardDescription>Assign work to the volunteers in this team.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                <Plus className="size-4" />
                Add task
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                <ul className="divide-y divide-border">
                  {tasks.map((task) => {
                    const overdue =
                      task.due_date &&
                      new Date(task.due_date) < new Date(new Date().toDateString()) &&
                      task.status !== "done" &&
                      task.status !== "cancelled"

                    return (
                      <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                        <button
                          type="button"
                          aria-label="Mark as done"
                          title="Mark as done"
                          disabled={task.status === "done"}
                          onClick={() =>
                            updateTaskStatus.mutate(
                              { taskId: task.id, status: "done", departmentId: id! },
                              {
                                onSuccess: () => toast.success("Task completed"),
                                onError: (error) => toast.error(error.message),
                              }
                            )
                          }
                          className={
                            task.status === "done"
                              ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                              : "flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
                          }
                        >
                          <Check className="size-3" />
                        </button>

                        <div className="min-w-40 flex-1">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {task.volunteers && <span>{task.volunteers.full_name}</span>}
                            {task.due_date && (
                              <span className={overdue ? "font-medium text-destructive" : undefined}>
                                Due {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge className={TASK_PRIORITY_BADGE[task.priority as TaskPriority]}>
                            {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                          </Badge>
                          <Badge variant="secondary">
                            {TASK_STATUS_LABELS[task.status as TaskStatus]}
                          </Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  title="No tasks yet"
                  description="Create a task and assign it to one of your volunteers."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent>
              {events.length ? (
                <ul className="divide-y divide-border">
                  {events.map((event) => (
                    <li key={event!.id} className="flex items-center justify-between gap-2 py-3">
                      <Link
                        to={`/events/${event!.id}`}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {event!.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(event!.date).toLocaleDateString()}
                        </span>
                        <Badge variant="secondary">{event!.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No events yet"
                  description="Events involving this department will show here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addLeaderOpen} onOpenChange={setAddLeaderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add department leader</DialogTitle>
            <DialogDescription>
              Pick an internal user. They will get leader access to {department.name}.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a user" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name} — {ROLE_LABELS[user.role as UserRole]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddLeaderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLeader} disabled={!selectedUserId || addLeader.isPending}>
              {addLeader.isPending ? "Adding…" : "Add leader"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* create a task for this team */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New task for {department.name}</DialogTitle>
            <DialogDescription>Assign it to one of your volunteers.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="dt-title">Title *</FieldLabel>
              <Input
                id="dt-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="dt-desc">Description</FieldLabel>
              <Textarea
                id="dt-desc"
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Assign to</FieldLabel>
              <Select value={taskAssignee} onValueChange={(v) => setTaskAssignee(v ?? NO_ASSIGNEE)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
                  {volunteers
                    .filter((vd) => vd.volunteers)
                    .map((vd) => (
                      <SelectItem key={vd.volunteers!.id} value={vd.volunteers!.id}>
                        {vd.volunteers!.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="dt-due">Due date</FieldLabel>
                <Input
                  id="dt-due"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v ?? "medium")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={taskTitle.trim().length < 2 || createTask.isPending}
              onClick={async () => {
                try {
                  await createTask.mutateAsync({
                    departmentId: id!,
                    title: taskTitle.trim(),
                    description: taskDescription || null,
                    assignedVolunteerId: taskAssignee === NO_ASSIGNEE ? null : taskAssignee,
                    dueDate: taskDueDate || null,
                    priority: taskPriority,
                    createdBy: profile?.id ?? null,
                  })
                  toast.success("Task created")
                  setTaskTitle("")
                  setTaskDescription("")
                  setTaskAssignee(NO_ASSIGNEE)
                  setTaskDueDate("")
                  setTaskPriority("medium")
                  setTaskDialogOpen(false)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to create task")
                }
              }}
            >
              {createTask.isPending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* add volunteers to this team */}
      <Dialog open={addVolunteersOpen} onOpenChange={setAddVolunteersOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add volunteers to {department.name}</DialogTitle>
            <DialogDescription>
              They join this team in addition to their primary team.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search by name…"
            value={volunteerSearch}
            onChange={(e) => setVolunteerSearch(e.target.value)}
          />

          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {availableVolunteers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No other volunteers match.
              </p>
            ) : (
              availableVolunteers.map((volunteer) => (
                <label
                  key={volunteer.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedVolunteerIds.includes(volunteer.id)}
                    onCheckedChange={(checked) =>
                      setSelectedVolunteerIds((prev) =>
                        checked ? [...prev, volunteer.id] : prev.filter((v) => v !== volunteer.id)
                      )
                    }
                  />
                  <Avatar className="size-7">
                    {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                    <AvatarFallback className="bg-accent text-[0.65rem] text-accent-foreground">
                      {initials(volunteer.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{volunteer.full_name}</span>
                  {volunteer.departments && (
                    <span className="text-xs text-muted-foreground">
                      {volunteer.departments.name}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{selectedVolunteerIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddVolunteersOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedVolunteerIds.length || addVolunteers.isPending}
                onClick={async () => {
                  try {
                    await addVolunteers.mutateAsync({
                      departmentId: id!,
                      volunteerIds: selectedVolunteerIds,
                    })
                    toast.success(
                      `${selectedVolunteerIds.length} volunteer${
                        selectedVolunteerIds.length === 1 ? "" : "s"
                      } added`
                    )
                    setSelectedVolunteerIds([])
                    setVolunteerSearch("")
                    setAddVolunteersOpen(false)
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to add")
                  }
                }}
              >
                {addVolunteers.isPending ? "Adding…" : "Add to team"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
