import { useMemo, useState } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Field, FieldLabel } from "@/components/ui/field"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { useVolunteers } from "@/features/volunteers/use-volunteers"
import {
  useRemoveParticipant,
  useSaveParticipant,
  type BoothWithDetails,
  type ParticipantWithDetails,
} from "./use-events"
import { PARTICIPATION_STATUS_LABELS } from "@/lib/constants"
import type { ParticipationStatus } from "@/types/database.types"

const NONE = "__none__"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function ParticipantsTab({
  eventId,
  eventDate,
  participants,
  booths,
  isAdmin,
}: {
  eventId: string
  eventDate: string
  participants: ParticipantWithDetails[]
  booths: BoothWithDetails[]
  isAdmin: boolean
}) {
  const { data: volunteers = [] } = useVolunteers()
  const saveParticipant = useSaveParticipant()
  const removeParticipant = useRemoveParticipant()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ParticipantWithDetails | null>(null)
  const [volunteerId, setVolunteerId] = useState<string | null>(null)
  const [boothId, setBoothId] = useState<string>(NONE)
  const [role, setRole] = useState("")
  const [status, setStatus] = useState<ParticipationStatus>("invited")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  const availableVolunteers = useMemo(
    () => volunteers.filter((v) => !participants.some((p) => p.volunteer_id === v.id)),
    [volunteers, participants]
  )

  function openAdd() {
    setEditing(null)
    setVolunteerId(null)
    setBoothId(NONE)
    setRole("")
    setStatus("invited")
    setStartTime("")
    setEndTime("")
    setDialogOpen(true)
  }

  function openEdit(participant: ParticipantWithDetails) {
    setEditing(participant)
    setVolunteerId(participant.volunteer_id)
    setBoothId(participant.booth_id ?? NONE)
    setRole(participant.role_description ?? "")
    setStatus(participant.participation_status)
    setStartTime(participant.start_time ? participant.start_time.slice(11, 16) : "")
    setEndTime(participant.end_time ? participant.end_time.slice(11, 16) : "")
    setDialogOpen(true)
  }

  async function handleSave() {
    const targetVolunteerId = editing?.volunteer_id ?? volunteerId
    if (!targetVolunteerId) {
      toast.error("Choose a volunteer")
      return
    }
    const volunteer = volunteers.find((v) => v.id === targetVolunteerId)
    try {
      await saveParticipant.mutateAsync({
        participant: {
          ...(editing ? { id: editing.id } : {}),
          volunteer_id: targetVolunteerId,
          booth_id: boothId === NONE ? null : boothId,
          department_id: editing?.department_id ?? volunteer?.primary_department_id ?? null,
          role_description: role || null,
          participation_status: status,
          start_time: startTime ? `${eventDate}T${startTime}:00` : null,
          end_time: endTime ? `${eventDate}T${endTime}:00` : null,
        },
        eventId,
      })
      toast.success(editing ? "Participant updated" : "Volunteer added to event")
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    }
  }

  async function handleRemove(participant: ParticipantWithDetails) {
    try {
      await removeParticipant.mutateAsync({ participantId: participant.id, eventId })
      toast.success("Participant removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove")
    }
  }

  const totalHours = participants.reduce((sum, p) => sum + (p.total_hours ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {participants.length} participants · {totalHours.toFixed(1)} total hours
        </p>
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            Add volunteer
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {participants.length === 0 ? (
            <EmptyState
              title="No participants yet"
              description="Add volunteers to this event and assign them to booths."
              icon={Users}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Booth</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow
                    key={participant.id}
                    className={isAdmin ? "cursor-pointer" : undefined}
                    onClick={isAdmin ? () => openEdit(participant) : undefined}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          {participant.volunteers?.photo_url && (
                            <AvatarImage src={participant.volunteers.photo_url} />
                          )}
                          <AvatarFallback className="bg-accent text-[0.65rem] text-accent-foreground">
                            {participant.volunteers ? initials(participant.volunteers.full_name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">
                          {participant.volunteers?.full_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{participant.departments?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{participant.event_booths?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{participant.role_description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PARTICIPATION_STATUS_LABELS[participant.participation_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{participant.total_hours}h</TableCell>
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove participant"
                          onClick={() => handleRemove(participant)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit participation" : "Add volunteer to event"}</DialogTitle>
            <DialogDescription>
              Assign a booth, role and attendance details. Hours are calculated automatically from
              start/end time.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {!editing && (
              <Field>
                <FieldLabel>Volunteer *</FieldLabel>
                <Select value={volunteerId} onValueChange={setVolunteerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a volunteer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVolunteers.map((volunteer) => (
                      <SelectItem key={volunteer.id} value={volunteer.id}>
                        {volunteer.full_name}
                        {volunteer.departments ? ` — ${volunteer.departments.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Booth</FieldLabel>
                <Select value={boothId} onValueChange={(v) => setBoothId(v ?? NONE)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No booth</SelectItem>
                    {booths.map((booth) => (
                      <SelectItem key={booth.id} value={booth.id}>
                        {booth.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus((v ?? "invited") as ParticipationStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARTICIPATION_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="p-role">Role in booth</FieldLabel>
              <Input
                id="p-role"
                placeholder="e.g. Greeter, photographer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="p-start">Start time</FieldLabel>
                <Input
                  id="p-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-end">End time</FieldLabel>
                <Input
                  id="p-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveParticipant.isPending}>
              {saveParticipant.isPending ? "Saving…" : editing ? "Save changes" : "Add to event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
