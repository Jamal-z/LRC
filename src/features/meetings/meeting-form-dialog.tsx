import { useEffect, useState } from "react"
import { format } from "date-fns"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useAuth } from "@/features/auth/auth-context"
import { MEETING_MODE_LABELS } from "@/lib/constants"
import type { BoothMeetingRow, MeetingMode } from "@/types/database.types"
import { useManageableBooths, useSaveMeeting } from "./use-meetings"

const NONE = "__none__"

/**
 * Schedule a new booth meeting or edit a scheduled one. Opened from a booth
 * page it is pinned to that booth; opened from the Meetings page the leader
 * picks one of the booths they lead.
 */
export function MeetingFormDialog({
  open,
  onOpenChange,
  meeting,
  booth,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meeting?: BoothMeetingRow | null
  booth?: { id: string; name: string; event_id: string } | null
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

  useEffect(() => {
    if (!open) return
    setBoothId(meeting?.booth_id ?? booth?.id ?? NONE)
    setTitle(meeting?.title ?? "")
    setAgenda(meeting?.agenda ?? "")
    setScheduledAt(meeting ? format(new Date(meeting.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "")
    setDuration(meeting?.planned_duration_minutes?.toString() ?? "60")
    setMode(meeting?.mode ?? "in_person")
    setLocation(meeting?.location ?? "")
  }, [open, meeting, booth])

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
    const minutes = Number.parseInt(duration, 10)
    try {
      const id = await saveMeeting.mutateAsync({
        ...(meeting ? { id: meeting.id } : { created_by: profile?.id ?? null }),
        booth_id: boothId,
        event_id: eventId,
        title: title.trim(),
        agenda: agenda.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        planned_duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
        mode,
        location: location.trim() || null,
      })
      toast.success(meeting ? "Meeting updated" : "Meeting scheduled — the team has been notified")
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

            <Field>
              <FieldLabel htmlFor="m-location">
                {mode === "online" ? "Meeting link" : "Location"}
              </FieldLabel>
              <Input
                id="m-location"
                placeholder={mode === "online" ? "https://meet.google.com/…" : "e.g. Room 204"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </div>

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
          <Button onClick={handleSave} disabled={saveMeeting.isPending}>
            {saveMeeting.isPending ? "Saving…" : meeting ? "Save changes" : "Schedule meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
