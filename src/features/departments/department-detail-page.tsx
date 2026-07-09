import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Building2, Plus, UserMinus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  useAdminUsers,
  useDepartmentDetail,
  useRemoveDepartmentLeader,
} from "./use-department-details"
import {
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  VOLUNTEER_STATUS_BADGE,
  VOLUNTEER_STATUS_LABELS,
} from "@/lib/constants"
import type { TaskStatus, UserRole, VolunteerStatus } from "@/types/database.types"

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

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

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
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="volunteers">
          <Card>
            <CardContent className="p-0">
              {volunteers.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Membership</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {volunteers
                      .filter((vd) => vd.volunteers)
                      .map((vd) => (
                        <TableRow
                          key={vd.volunteers!.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/volunteers/${vd.volunteers!.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                {vd.volunteers!.photo_url && (
                                  <AvatarImage src={vd.volunteers!.photo_url} />
                                )}
                                <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                                  {initials(vd.volunteers!.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground">
                                {vd.volunteers!.full_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={VOLUNTEER_STATUS_BADGE[vd.volunteers!.status as VolunteerStatus]}
                            >
                              {VOLUNTEER_STATUS_LABELS[vd.volunteers!.status as VolunteerStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{vd.volunteers!.phone ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={vd.is_primary ? "secondary" : "outline"}>
                              {vd.is_primary ? "Primary" : "Secondary"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  title="No volunteers in this department"
                  description="Assign volunteers from the Volunteers page."
                  icon={Users}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent>
              {tasks.length ? (
                <ul className="divide-y divide-border">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 py-3">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <div className="flex items-center gap-2">
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <Badge variant="secondary">
                          {TASK_STATUS_LABELS[task.status as TaskStatus]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No tasks yet"
                  description="Tasks for this department will show here."
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
    </div>
  )
}
