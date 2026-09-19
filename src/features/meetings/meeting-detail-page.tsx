import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { format } from "date-fns"
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  CheckSquare,
  Clock,
  ClipboardPen,
  Lightbulb,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Store,
  Trash2,
  Users2,
  Video,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  MEETING_MODE_LABELS,
  MEETING_STATUS_BADGE,
  MEETING_STATUS_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { MeetingMode, TaskPriority } from "@/types/database.types"
import {
  needsMinutes,
  useBoothTeam,
  useDeleteMeeting,
  useLeadsBooth,
  useMeeting,
  useRecordMinutes,
  useSetMeetingStatus,
  type MeetingDetail,
} from "./use-meetings"
import { MeetingFormDialog } from "./meeting-form-dialog"

const UNASSIGNED = "__none__"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

interface ActionItemDraft {
  key: string
  title: string
  assignee: string // "u:<profile id>" | "v:<volunteer id>" | UNASSIGNED
  due_date: string
  priority: TaskPriority
}

function newActionItem(): ActionItemDraft {
  return {
    key: crypto.randomUUID(),
    title: "",
    assignee: UNASSIGNED,
    due_date: "",
    priority: "medium",
  }
}

export function MeetingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: meeting, isLoading } = useMeeting(id)
  const { data: leadsBooth = false } = useLeadsBooth(meeting?.booth_id, profile?.id)
  const setStatus = useSetMeetingStatus()
  const deleteMeeting = useDeleteMeeting()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [recording, setRecording] = useState(false)

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const canManage = isAdmin || leadsBooth

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <EmptyState
        title="Meeting not found"
        description="It may have been deleted, or you don't have access to it."
        icon={Users2}
      />
    )
  }

  const when = new Date(meeting.scheduled_at)
  const overdue = needsMinutes(meeting)
  const locationIsLink = !!meeting.location && /^https?:\/\//i.test(meeting.location)

  async function handleStatus(status: "scheduled" | "cancelled") {
    try {
      await setStatus.mutateAsync({ id: meeting!.id, status })
      toast.success(status === "cancelled" ? "Meeting cancelled" : "Meeting restored")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update meeting")
    }
  }

  async function handleDelete() {
    try {
      await deleteMeeting.mutateAsync(meeting!.id)
      toast.success("Meeting deleted")
      navigate("/meetings")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete meeting")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/meetings" />}>
          <ArrowLeft className="size-4" />
          All meetings
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Users2 className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {meeting.title}
                </h1>
                {overdue ? (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    Needs minutes
                  </Badge>
                ) : (
                  <Badge className={MEETING_STATUS_BADGE[meeting.status]}>
                    {MEETING_STATUS_LABELS[meeting.status]}
                  </Badge>
                )}
              </div>
              <Link
                to={`/events/${meeting.event_id}/booths/${meeting.booth_id}`}
                className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
              >
                <Store className="size-3.5" />
                {meeting.event_booths?.name ?? "Booth"}
                {meeting.events && ` — ${meeting.events.name}`}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  {format(when, "EEE d MMM yyyy, HH:mm")}
                </span>
                {meeting.planned_duration_minutes && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {meeting.planned_duration_minutes} min planned
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  {meeting.mode === "online" ? (
                    <Video className="size-3.5" />
                  ) : (
                    <MapPin className="size-3.5" />
                  )}
                  {MEETING_MODE_LABELS[meeting.mode]}
                  {meeting.location &&
                    (locationIsLink ? (
                      <a
                        href={meeting.location}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        · Join link
                      </a>
                    ) : (
                      ` · ${meeting.location}`
                    ))}
                </span>
              </div>
              {meeting.creator && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Scheduled by {meeting.creator.full_name}
                </p>
              )}
            </div>
          </div>

          {canManage && !recording && (
            <div className="flex flex-wrap gap-2">
              {meeting.status === "scheduled" && (
                <>
                  <Button onClick={() => setRecording(true)}>
                    <ClipboardPen className="size-4" />
                    Record minutes
                  </Button>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStatus("cancelled")}
                    disabled={setStatus.isPending}
                  >
                    <Ban className="size-4" />
                    Cancel meeting
                  </Button>
                </>
              )}
              {meeting.status === "completed" && (
                <Button variant="outline" onClick={() => setRecording(true)}>
                  <Pencil className="size-4" />
                  Edit minutes
                </Button>
              )}
              {meeting.status === "cancelled" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatus("scheduled")}
                  disabled={setStatus.isPending}
                >
                  <RotateCcw className="size-4" />
                  Restore
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete meeting"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {meeting.agenda && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agenda</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.agenda}</p>
          </CardContent>
        </Card>
      )}

      {recording ? (
        <MinutesForm meeting={meeting} onDone={() => setRecording(false)} />
      ) : meeting.status === "completed" ? (
        <MinutesView meeting={meeting} />
      ) : overdue && canManage ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <ClipboardPen className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">This meeting is over</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Record who attended, how long it took and what came out of it.
              </p>
            </div>
            <Button onClick={() => setRecording(true)}>
              <ClipboardPen className="size-4" />
              Record minutes
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <MeetingFormDialog open={editOpen} onOpenChange={setEditOpen} meeting={meeting} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{meeting.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The meeting, its attendance and minutes are erased. Tasks created from it stay on
              the board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ------------------------------------------------------------------
// Minutes — read-only
// ------------------------------------------------------------------
function MinutesView({ meeting }: { meeting: MeetingDetail }) {
  const attendance = [...meeting.booth_meeting_attendance].sort((a, b) =>
    (a.volunteers?.full_name ?? "").localeCompare(b.volunteers?.full_name ?? "")
  )
  const present = attendance.filter((a) => a.attended)
  const absent = attendance.filter((a) => !a.attended)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>
              {MEETING_MODE_LABELS[meeting.mode]}
              {meeting.actual_duration_minutes && ` · ${meeting.actual_duration_minutes} min`}
              {meeting.completed_at &&
                ` · recorded ${format(new Date(meeting.completed_at), "d MMM yyyy")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {meeting.summary || <span className="text-muted-foreground">No summary written.</span>}
            </p>
          </CardContent>
        </Card>

        {meeting.ideas_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4 text-amber-500" />
                Ideas & notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.ideas_notes}</p>
            </CardContent>
          </Card>
        )}

        <ActionItemsCard tasks={meeting.tasks} />
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Attendance</CardTitle>
          <CardDescription>
            {present.length} of {attendance.length} booth volunteers attended
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {attendance.length === 0 && (
            <p className="text-sm text-muted-foreground">No attendance recorded.</p>
          )}
          {[...present, ...absent].map((row) => (
            <div key={row.id} className="flex items-center gap-2.5 rounded-md px-1 py-1">
              <Avatar className="size-7">
                {row.volunteers?.photo_url && <AvatarImage src={row.volunteers.photo_url} />}
                <AvatarFallback className="bg-accent text-[0.65rem] text-accent-foreground">
                  {row.volunteers ? initials(row.volunteers.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <Link
                to={`/volunteers/${row.volunteer_id}`}
                className={cn(
                  "flex-1 text-sm hover:underline",
                  row.attended ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {row.volunteers?.full_name ?? "—"}
              </Link>
              {row.attended ? (
                <Check className="size-4 text-emerald-600" aria-label="Attended" />
              ) : (
                <X className="size-4 text-muted-foreground" aria-label="Absent" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ActionItemsCard({ tasks }: { tasks: MeetingDetail["tasks"] }) {
  if (tasks.length === 0) return null
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="size-4" />
          Action items
        </CardTitle>
        <Button variant="ghost" size="sm" render={<Link to="/tasks" />}>
          Open Tasks board
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 py-2">
              <span
                className={cn(
                  "flex-1 text-sm",
                  task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {task.title}
              </span>
              {(task.assignee || task.volunteer_assignee) && (
                <span className="text-xs text-muted-foreground">
                  {task.assignee?.full_name ?? task.volunteer_assignee?.full_name}
                </span>
              )}
              {task.due_date && (
                <span className="text-xs text-muted-foreground">
                  due {format(new Date(task.due_date), "d MMM")}
                </span>
              )}
              <Badge className={cn("text-[0.65rem]", TASK_PRIORITY_BADGE[task.priority])}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </Badge>
              <Badge variant="outline" className="text-[0.65rem]">
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------------
// Minutes — the form a leader fills in after the meeting
// ------------------------------------------------------------------
function MinutesForm({ meeting, onDone }: { meeting: MeetingDetail; onDone: () => void }) {
  const { profile } = useAuth()
  const { data: team, isLoading: teamLoading } = useBoothTeam(meeting.booth_id)
  const recordMinutes = useRecordMinutes()

  const [attended, setAttended] = useState<Set<string>>(
    () =>
      new Set(meeting.booth_meeting_attendance.filter((a) => a.attended).map((a) => a.volunteer_id))
  )
  const [duration, setDuration] = useState(
    (meeting.actual_duration_minutes ?? meeting.planned_duration_minutes ?? "").toString()
  )
  const [mode, setMode] = useState<MeetingMode>(meeting.mode)
  const [summary, setSummary] = useState(meeting.summary ?? "")
  const [ideasNotes, setIdeasNotes] = useState(meeting.ideas_notes ?? "")
  const [actionItems, setActionItems] = useState<ActionItemDraft[]>([])

  // current booth volunteers, plus anyone already on the sheet who has since left the booth
  const roster = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; photo_url: string | null }>()
    for (const v of team?.volunteers ?? []) map.set(v.id, v)
    for (const a of meeting.booth_meeting_attendance) {
      if (a.volunteers && !map.has(a.volunteer_id)) map.set(a.volunteer_id, a.volunteers)
    }
    return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [team?.volunteers, meeting.booth_meeting_attendance])

  function toggle(volunteerId: string, checked: boolean) {
    setAttended((prev) => {
      const next = new Set(prev)
      if (checked) next.add(volunteerId)
      else next.delete(volunteerId)
      return next
    })
  }

  function updateItem(key: string, patch: Partial<ActionItemDraft>) {
    setActionItems((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function handleSave() {
    if (summary.trim().length < 3) {
      toast.error("Write a short summary of the meeting")
      return
    }
    const minutes = Number.parseInt(duration, 10)
    const items = actionItems.filter((item) => item.title.trim())
    try {
      await recordMinutes.mutateAsync({
        meeting,
        actual_duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
        mode,
        summary: summary.trim(),
        ideas_notes: ideasNotes.trim() || null,
        attendance: roster.map((v) => ({ volunteer_id: v.id, attended: attended.has(v.id) })),
        actionItems: items.map((item) => ({
          title: item.title.trim(),
          assigned_to_user_id: item.assignee.startsWith("u:") ? item.assignee.slice(2) : null,
          assigned_to_volunteer_id: item.assignee.startsWith("v:") ? item.assignee.slice(2) : null,
          due_date: item.due_date || null,
          priority: item.priority,
        })),
        userId: profile?.id ?? null,
      })
      toast.success(
        items.length
          ? `Minutes saved — ${items.length} task${items.length === 1 ? "" : "s"} added to the board`
          : "Minutes saved"
      )
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save minutes")
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meeting minutes</CardTitle>
            <CardDescription>What happened, how long it took, and what you decided.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mm-duration">Actual duration (min)</FieldLabel>
                <Input
                  id="mm-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select value={mode} onValueChange={(v) => setMode((v ?? mode) as MeetingMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEETING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="mm-summary">Summary *</FieldLabel>
              <Textarea
                id="mm-summary"
                rows={5}
                placeholder="What was discussed?"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="mm-ideas">Ideas & notes</FieldLabel>
              <Textarea
                id="mm-ideas"
                rows={4}
                placeholder="Ideas that came up, open questions, things to remember…"
                value={ideasNotes}
                onChange={(e) => setIdeasNotes(e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="size-4" />
              Action items
            </CardTitle>
            <CardDescription>
              Each one becomes a task on the Tasks board, linked back to this meeting.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {meeting.tasks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {meeting.tasks.length} task{meeting.tasks.length === 1 ? "" : "s"} already created
                from this meeting — new ones below are added alongside.
              </p>
            )}

            {actionItems.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_auto]"
              >
                <Input
                  placeholder="What needs to be done?"
                  value={item.title}
                  onChange={(e) => updateItem(item.key, { title: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove action item"
                  className="justify-self-end"
                  onClick={() => setActionItems((items) => items.filter((i) => i.key !== item.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
                <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-3">
                  <Select
                    value={item.assignee}
                    onValueChange={(v) => updateItem(item.key, { assignee: v ?? UNASSIGNED })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {team?.leaders.map((leader) => (
                        <SelectItem key={leader.id} value={`u:${leader.id}`}>
                          {leader.full_name} (leader)
                        </SelectItem>
                      ))}
                      {team?.volunteers.map((volunteer) => (
                        <SelectItem key={volunteer.id} value={`v:${volunteer.id}`}>
                          {volunteer.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    aria-label="Due date"
                    value={item.due_date}
                    onChange={(e) => updateItem(item.key, { due_date: e.target.value })}
                  />
                  <Select
                    value={item.priority}
                    onValueChange={(v) =>
                      updateItem(item.key, { priority: (v ?? "medium") as TaskPriority })
                    }
                  >
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
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="self-start"
              onClick={() => setActionItems((items) => [...items, newActionItem()])}
            >
              <Plus className="size-4" />
              Add action item
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={recordMinutes.isPending}>
            {recordMinutes.isPending ? "Saving…" : "Save minutes"}
          </Button>
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Who attended?</CardTitle>
          <CardDescription>
            {attended.size} of {roster.length} booth volunteers
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {teamLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : roster.length === 0 ? (
            <Field>
              <FieldDescription>
                This booth has no volunteers yet. Add them from the booth page to track attendance.
              </FieldDescription>
            </Field>
          ) : (
            <>
              <div className="mb-1 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttended(new Set(roster.map((v) => v.id)))}
                >
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAttended(new Set())}>
                  Clear
                </Button>
              </div>
              {roster.map((volunteer) => (
                <label
                  key={volunteer.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={attended.has(volunteer.id)}
                    onCheckedChange={(checked) => toggle(volunteer.id, !!checked)}
                  />
                  <Avatar className="size-7">
                    {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                    <AvatarFallback className="bg-accent text-[0.65rem] text-accent-foreground">
                      {initials(volunteer.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{volunteer.full_name}</span>
                </label>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
