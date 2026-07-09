import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CalendarDays, KanbanSquare, MessageSquare, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartments } from "@/features/departments/use-departments"
import { useAdminUsers } from "@/features/departments/use-department-details"
import { useEvents } from "@/features/events/use-events"
import {
  useAddTaskComment,
  useDeleteTask,
  useMoveTask,
  useSaveTask,
  useTaskComments,
  useTasks,
  type TaskWithDetails,
} from "./use-tasks"
import {
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/constants"
import type { TaskPriority, TaskStatus } from "@/types/database.types"
import { cn } from "@/lib/utils"

const NONE = "__none__"

function TaskCard({
  task,
  onClick,
  onComplete,
  dragging,
}: {
  task: TaskWithDetails
  onClick?: () => void
  onComplete?: () => void
  dragging?: boolean
}) {
  const overdue =
    task.due_date &&
    new Date(task.due_date) < new Date(new Date().toDateString()) &&
    task.status !== "done" &&
    task.status !== "cancelled"

  const completable = task.status !== "done" && task.status !== "cancelled"

  return (
    <div
      onClick={onClick}
      className={cn(
        "group/task cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "rotate-2 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-2">
        {onComplete && completable && (
          <button
            type="button"
            aria-label="Mark as done"
            title="Mark as done"
            onClick={(e) => {
              e.stopPropagation()
              onComplete()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
          >
            <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-current stroke-2">
              <path d="M2 6.5L4.5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {task.status === "done" && (
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-current stroke-2">
              <path d="M2 6.5L4.5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge className={cn("text-[0.65rem]", TASK_PRIORITY_BADGE[task.priority])}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.departments && (
          <Badge variant="outline" className="text-[0.65rem]">
            {task.departments.name}
          </Badge>
        )}
        {task.due_date && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[0.68rem]",
              overdue ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            <CalendarDays className="size-3" />
            {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      {(task.assignee || task.volunteer_assignee) && (
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
          {task.assignee?.full_name ?? task.volunteer_assignee?.full_name}
        </p>
      )}
    </div>
  )
}

function DraggableTaskCard({
  task,
  onClick,
  onComplete,
}: {
  task: TaskWithDetails
  onClick: () => void
  onComplete: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-30")}>
      <TaskCard task={task} onClick={onClick} onComplete={onComplete} />
    </div>
  )
}

function BoardColumn({
  status,
  tasks,
  onTaskClick,
  onTaskComplete,
}: {
  status: TaskStatus
  tasks: TaskWithDetails[]
  onTaskClick: (task: TaskWithDetails) => void
  onTaskComplete: (task: TaskWithDetails) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
          isOver && "bg-accent ring-2 ring-primary/30"
        )}
      >
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onComplete={() => onTaskComplete(task)}
          />
        ))}
      </div>
    </div>
  )
}

export function TasksPage() {
  const { profile } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: departments = [] } = useDepartments()
  const { data: users = [] } = useAdminUsers()
  const { data: events = [] } = useEvents()
  const saveTask = useSaveTask()
  const moveTask = useMoveTask()
  const deleteTask = useDeleteTask()
  const addComment = useAddTaskComment()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TaskWithDetails | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [departmentId, setDepartmentId] = useState(NONE)
  const [assigneeId, setAssigneeId] = useState(NONE)
  const [eventId, setEventId] = useState(NONE)
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [newComment, setNewComment] = useState("")

  const { data: comments = [] } = useTaskComments(editing?.id)

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskWithDetails[]>()
    for (const s of TASK_STATUS_ORDER) map.set(s, [])
    for (const task of tasks) map.get(task.status)?.push(task)
    return map
  }, [tasks])

  function openAdd() {
    setEditing(null)
    setTitle("")
    setDescription("")
    setDepartmentId(NONE)
    setAssigneeId(NONE)
    setEventId(NONE)
    setDueDate("")
    setPriority("medium")
    setStatus("todo")
    setNewComment("")
    setDialogOpen(true)
  }

  function openEdit(task: TaskWithDetails) {
    setEditing(task)
    setTitle(task.title)
    setDescription(task.description ?? "")
    setDepartmentId(task.department_id ?? NONE)
    setAssigneeId(task.assigned_to_user_id ?? NONE)
    setEventId(task.related_event_id ?? NONE)
    setDueDate(task.due_date ?? "")
    setPriority(task.priority)
    setStatus(task.status)
    setNewComment("")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (title.trim().length < 2) {
      toast.error("Task title is required")
      return
    }
    try {
      await saveTask.mutateAsync({
        ...(editing ? { id: editing.id } : { created_by: profile?.id ?? null }),
        title: title.trim(),
        description: description || null,
        department_id: departmentId === NONE ? null : departmentId,
        assigned_to_user_id: assigneeId === NONE ? null : assigneeId,
        related_event_id: eventId === NONE ? null : eventId,
        due_date: dueDate || null,
        priority,
        status,
      })
      toast.success(editing ? "Task updated" : "Task created")
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save task")
    }
  }

  async function handleDelete() {
    if (!editing) return
    try {
      await deleteTask.mutateAsync(editing.id)
      toast.success("Task deleted")
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task")
    }
  }

  async function handleAddComment() {
    if (!editing || !profile || !newComment.trim()) return
    try {
      await addComment.mutateAsync({
        taskId: editing.id,
        userId: profile.id,
        comment: newComment.trim(),
      })
      setNewComment("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment")
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === active.id)
    if (task && task.status !== newStatus) {
      moveTask.mutate({ taskId: task.id, status: newStatus })
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between columns to update their status.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Create Task
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent>
            <p className="py-12 text-center text-sm text-muted-foreground">Loading board…</p>
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No tasks yet"
              description="Create your first task to start organizing the team's work."
              icon={KanbanSquare}
            />
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {TASK_STATUS_ORDER.map((columnStatus) => (
              <BoardColumn
                key={columnStatus}
                status={columnStatus}
                tasks={byStatus.get(columnStatus) ?? []}
                onTaskClick={openEdit}
                onTaskComplete={(task) => moveTask.mutate({ taskId: task.id, status: "done" })}
              />
            ))}
          </div>
          <DragOverlay>{activeTask && <TaskCard task={activeTask} dragging />}</DragOverlay>
        </DndContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "Create task"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update details, or add comments below." : "Add a task to the board."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="t-title">Title *</FieldLabel>
              <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="t-desc">Description</FieldLabel>
              <Textarea
                id="t-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Department</FieldLabel>
                <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? NONE)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Assign to</FieldLabel>
                <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? NONE)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Priority</FieldLabel>
                <Select value={priority} onValueChange={(v) => setPriority((v ?? "medium") as TaskPriority)}>
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

              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus((v ?? "todo") as TaskStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_ORDER.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TASK_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="t-due">Due date</FieldLabel>
                <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>

              <Field>
                <FieldLabel>Related event</FieldLabel>
                <Select value={eventId} onValueChange={(v) => setEventId(v ?? NONE)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {editing && (
              <div className="mt-1 rounded-lg border border-border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="size-3.5" />
                  Comments ({comments.length})
                </p>
                <ul className="mb-2 flex max-h-40 flex-col gap-2 overflow-y-auto">
                  {comments.map((comment) => (
                    <li key={comment.id} className="rounded-lg bg-muted/60 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">
                        {comment.profiles?.full_name ?? "—"}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">{comment.comment}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  />
                  <Button variant="outline" onClick={handleAddComment} disabled={!newComment.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2">
            {editing ? (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveTask.isPending}>
                {saveTask.isPending ? "Saving…" : editing ? "Save changes" : "Create task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
