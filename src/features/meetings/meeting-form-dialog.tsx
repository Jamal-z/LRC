import { useEffect, useMemo, useState } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { AlertTriangle, CheckCircle2, DoorOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useAuth } from "@/features/auth/auth-context"
import { CENTER_HALL_NAME, MEETING_MODE_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { BoothMeetingRow, MeetingMode, MeetingRoom } from "@/types/database.types"
import {
  findHallClash,
  meetingEnd,
  useManageableBooths,
  useMeetingCalendar,
  useSaveMeeting,
} from "./use-meetings"

const NONE = "__none__"

/**
 * Schedule a new booth meeting or edit a scheduled one. Opened from a booth
 * page it is pinned to that booth; opened from the Meetings page the leader
 * picks one of the booths they lead.
 *
 * In-person meetings go in the center hall when it is free; when it is
 * taken the leader can ask the committee to book another room instead.
 */
export function MeetingFormDialog({
  open,
  onOpenChange,
  meeting,
  booth,
  initialStart,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meeting?: BoothMeetingRow | null
  booth?: { id: string; name: string; event_id: string } | null
  /** Pre-fills the date for a new meeting, e.g. a free slot picked on the calendar. */
  initialStart?: Date | null
  onSaved?: (id: string) => void
}) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const pickBooth = !meeting && !booth
  const { data: booths = [] } = useManageableBooths(pickBooth ? profile?.id : undefined, isAdmin)
  const saveMeeting = useSaveMeeting()

  const [boothId, setBoothId] = useState(NONE)
  const [title, setTitle] = useState("")
  const [agenda, setAgenda] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [duration, setDuration] = useState("60")
  const [mode, setMode] = useState<MeetingMode>("in_person")
  const [location, setLocation] = useState("")
  const [requestRoom, setRequestRoom] = useState(false)

  useEffect(() => {
    if (!open) return
    setBoothId(meeting?.booth_id ?? booth?.id ?? NONE)
    setTitle(meeting?.title ?? "")
    setAgenda(meeting?.agenda ?? "")
    setScheduledAt(
      meeting
        ? format(new Date(meeting.scheduled_at), "yyyy-MM-dd'T'HH:mm")
        : initialStart
          ? format(initialStart, "yyyy-MM-dd'T'HH:mm")
          : ""
    )
    setDuration(meeting?.planned_duration_minutes?.toString() ?? "60")
    setMode(meeting?.mode ?? "in_person")
    setLocation(meeting?.mode === "online" ? (meeting.location ?? "") : "")
    setRequestRoom(meeting?.room === "booking_requested")
  }, [open, meeting, booth, initialStart])

  const minutes = Number.parseInt(duration, 10)
  const plannedMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : null
  const start = scheduledAt ? new Date(scheduledAt) : null
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null
  const end = validStart ? meetingEnd(validStart, plannedMinutes) : null

  // the whole day around the chosen time, so we can show what else is in the hall
  const dayStart = startOfDay(validStart ?? new Date())
  const { data: dayEntries = [], isLoading: hallLoading } = useMeetingCalendar(
    dayStart,
    addDays(dayStart, 1)
  )

  // a room the committee already booked stays as long as the slot doesn't move
  const keepBooked =
    meeting?.room === "booked" &&
    mode === "in_person" &&
    validStart?.getTime() === new Date(meeting.scheduled_at).getTime() &&
    plannedMinutes === meeting.planned_duration_minutes

  const clash =
    mode === "in_person" && validStart && end && !keepBooked
      ? findHallClash(dayEntries, validStart, end, meeting?.id)
      : undefined

  const hallToday = useMemo(
    () =>
      dayEntries
        .filter((e) => e.room === "center_hall" && e.id !== meeting?.id)
        .map((e) => {
          const s = new Date(e.scheduled_at)
          return {
            id: e.id,
            label: `${format(s, "HH:mm")}–${format(meetingEnd(s, e.duration_minutes), "HH:mm")}`,
            booth: e.booth_name ?? "Booth",
          }
        }),
    [dayEntries, meeting?.id]
  )

  const room: MeetingRoom | null =
    mode === "online"
      ? null
      : keepBooked
        ? "booked"
        : clash
          ? requestRoom
            ? "booking_requested"
            : null
          : "center_hall"

  async function handleSave() {
    const eventId =
      meeting?.event_id ?? booth?.event_id ?? booths.find((b) => b.id === boothId)?.event_id
    if (boothId === NONE || !eventId) {
      toast.error("Pick the booth this meeting is for")
      return
    }
    if (title.trim().length < 2) {
      toast.error("Give the meeting a title")
      return
    }
    if (!scheduledAt) {
      toast.error("Pick a date and time")
      return
    }
    if (mode === "in_person" && hallLoading) {
      toast.error("Still checking the center hall — try again in a moment")
      return
    }
    if (mode === "in_person" && !room) {
      toast.error("The center hall is taken then — pick another time or request a room booking")
      return
    }
    try {
      const id = await saveMeeting.mutateAsync({
        ...(meeting ? { id: meeting.id } : { created_by: profile?.id ?? null }),
        booth_id: boothId,
        event_id: eventId,
        title: title.trim(),
        agenda: agenda.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        planned_duration_minutes: plannedMinutes,
        mode,
        room,
        location:
          room === "center_hall"
            ? CENTER_HALL_NAME
            : room === "booked"
              ? (meeting?.location ?? null)
              : room === "booking_requested"
                ? null
                : location.trim() || null,
      })
      toast.success(
        room === "booking_requested" && meeting?.room !== "booking_requested"
          ? "Saved — the committee has been asked to book a room"
          : meeting
            ? "Meeting updated"
            : "Meeting scheduled — the team has been notified"
      )
      onOpenChange(false)
      onSaved?.(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save meeting")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meeting ? "Edit meeting" : "Schedule a meeting"}</DialogTitle>
          <DialogDescription>
            {booth
              ? `A meeting with the ${booth.name} team.`
              : "Plan a meeting with your booth team. You'll record the minutes once it's over."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {pickBooth && (
            <Field>
              <FieldLabel>Booth *</FieldLabel>
              <Select value={boothId} onValueChange={(v) => setBoothId(v ?? NONE)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    {booths.length ? "Choose a booth" : "You don't lead any booth yet"}
                  </SelectItem>
                  {booths.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.events && ` — ${b.events.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="m-title">Title *</FieldLabel>
            <Input
              id="m-title"
              placeholder="e.g. Kick-off meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="m-when">Date & time *</FieldLabel>
              <Input
                id="m-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="m-duration">Planned duration (min)</FieldLabel>
              <Input
                id="m-duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={mode} onValueChange={(v) => setMode((v ?? "in_person") as MeetingMode)}>
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

            {mode === "online" && (
              <Field>
                <FieldLabel htmlFor="m-location">Meeting link</FieldLabel>
                <Input
                  id="m-location"
                  placeholder="https://meet.google.com/…"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </Field>
            )}
          </div>

          {mode === "in_person" && (
            <RoomStatus
              ready={!!validStart}
              loading={hallLoading}
              keepBooked={keepBooked ? (meeting?.location ?? "a room") : null}
              clash={
                clash
                  ? {
                      booth: clash.booth_name ?? "another team",
                      label: `${format(new Date(clash.scheduled_at), "HH:mm")}–${format(
                        meetingEnd(new Date(clash.scheduled_at), clash.duration_minutes),
                        "HH:mm"
                      )}`,
                    }
                  : null
              }
              hallToday={hallToday}
              requestRoom={requestRoom}
              onRequestRoomChange={setRequestRoom}
            />
          )}

          <Field>
            <FieldLabel htmlFor="m-agenda">Agenda</FieldLabel>
            <Textarea
              id="m-agenda"
              rows={3}
              placeholder="What will you go over?"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
            />
            <FieldDescription>Optional — shared with the booth's other leaders.</FieldDescription>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMeeting.isPending || (mode === "in_person" && !!validStart && !room)}
          >
            {saveMeeting.isPending ? "Saving…" : meeting ? "Save changes" : "Schedule meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RoomStatus({
  ready,
  loading,
  keepBooked,
  clash,
  hallToday,
  requestRoom,
  onRequestRoomChange,
}: {
  ready: boolean
  loading: boolean
  keepBooked: string | null
  clash: { booth: string; label: string } | null
  hallToday: { id: string; label: string; booth: string }[]
  requestRoom: boolean
  onRequestRoomChange: (value: boolean) => void
}) {
  const hall = CENTER_HALL_NAME.toLowerCase()

  if (!ready) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <DoorOpen className="size-4 shrink-0" />
        Pick a date and time to check whether the {hall} is free.
      </p>
    )
  }
  if (loading) {
    return (
      <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Checking the {hall}…
      </p>
    )
  }
  if (keepBooked) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        The committee booked {keepBooked} for this meeting.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-xs",
        clash
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {clash ? (
          <AlertTriangle className="size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0" />
        )}
        {clash
          ? `The ${hall} is taken ${clash.label} by ${clash.booth}.`
          : `The ${hall} is free then — it will be reserved for this meeting.`}
      </p>

      {hallToday.length > 0 && (
        <p className="opacity-80">
          Hall that day: {hallToday.map((h) => `${h.label} ${h.booth}`).join(" · ")}
        </p>
      )}

      {clash && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md bg-background/60 p-2 text-foreground">
          <Checkbox
            checked={requestRoom}
            onCheckedChange={(v) => onRequestRoomChange(v === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Request a room booking</span>
            <span className="block text-muted-foreground">
              Keep this time and ask the committee to book another room. Or change the time above.
            </span>
          </span>
        </label>
      )}
    </div>
  )
}
