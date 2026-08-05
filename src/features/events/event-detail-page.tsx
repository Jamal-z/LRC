import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Download,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  useDeleteGuest,
  useDeleteSponsor,
  useEventDetail,
  useSaveEvent,
  useSaveGuest,
  useSaveSponsor,
} from "./use-events"
import { EventFormDialog } from "./event-form-dialog"
import { BoothsTab } from "./booths-tab"
import { ParticipantsTab } from "./participants-tab"
import { EvaluationsTab } from "./evaluations-tab"
import { PhotoGallery } from "./photo-gallery"
import { EVENT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/constants"
import { exportToExcel, type ExportColumn } from "@/lib/export"
import type { TaskStatus } from "@/types/database.types"
import type { ParticipantWithDetails } from "./use-events"

export function EventDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data, isLoading } = useEventDetail(id)
  const saveEvent = useSaveEvent()
  const saveSponsor = useSaveSponsor()
  const deleteSponsor = useDeleteSponsor()
  const saveGuest = useSaveGuest()
  const deleteGuest = useDeleteGuest()

  const [editOpen, setEditOpen] = useState(false)
  const [sponsorOpen, setSponsorOpen] = useState(false)
  const [sponsorName, setSponsorName] = useState("")
  const [sponsorAmount, setSponsorAmount] = useState("")
  const [guestOpen, setGuestOpen] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [guestRole, setGuestRole] = useState("")
  const [reportNotes, setReportNotes] = useState<{ went_well: string; improve: string; notes: string } | null>(null)

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const { event, booths, participants, sponsors, guests, evaluations, tasks } = data
  const totalHours = participants.reduce((sum, p) => sum + (p.total_hours ?? 0), 0)
  const sponsorTotal = sponsors.reduce(
    (sum, s) => sum + (Number((s as { contribution_amount: number | null }).contribution_amount) || 0),
    0
  )

  async function handleAddSponsor() {
    if (!sponsorName.trim() || !id) return
    try {
      await saveSponsor.mutateAsync({
        sponsor: {
          sponsor_name: sponsorName.trim(),
          contribution_amount: sponsorAmount ? Number(sponsorAmount) : 0,
        },
        eventId: id,
      })
      toast.success("Sponsor added")
      setSponsorOpen(false)
      setSponsorName("")
      setSponsorAmount("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add sponsor")
    }
  }

  async function handleAddGuest() {
    if (!guestName.trim() || !id) return
    try {
      await saveGuest.mutateAsync({
        guest: { guest_name: guestName.trim(), role_or_title: guestRole || null },
        eventId: id,
      })
      toast.success("Guest added")
      setGuestOpen(false)
      setGuestName("")
      setGuestRole("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add guest")
    }
  }

  async function handleSaveReport() {
    if (!id || !reportNotes) return
    try {
      await saveEvent.mutateAsync({
        event: {
          id,
          what_went_well: reportNotes.went_well || null,
          what_needs_improvement: reportNotes.improve || null,
          post_event_notes: reportNotes.notes || null,
        },
      })
      toast.success("Report saved")
      setReportNotes(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report")
    }
  }

  const participantExportColumns: ExportColumn<ParticipantWithDetails>[] = [
    { header: "Volunteer", value: (p) => p.volunteers?.full_name },
    { header: "Department", value: (p) => p.departments?.name },
    { header: "Booth", value: (p) => p.event_booths?.name },
    { header: "Role", value: (p) => p.role_description },
    { header: "Status", value: (p) => p.participation_status },
    { header: "Hours", value: (p) => p.total_hours },
    { header: "Notes", value: (p) => p.notes },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/events" />}>
          <ArrowLeft className="size-4" />
          Back to events
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{event.name}</h1>
              <Badge variant="secondary">{EVENT_STATUS_LABELS[event.status]}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {new Date(event.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {(event.start_time || event.end_time) && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {event.start_time?.slice(0, 5) ?? "?"} – {event.end_time?.slice(0, 5) ?? "?"}
                </span>
              )}
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {event.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {participants.length} volunteers · {totalHours.toFixed(1)}h
              </span>
            </div>
            {event.short_description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{event.short_description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.event_departments.map((ed) => (
                <Badge key={ed.department_id} variant="outline">
                  {ed.departments.name}
                </Badge>
              ))}
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit event
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="booths">
        <TabsList className="flex-wrap">
          <TabsTrigger value="booths">Booths ({booths.length})</TabsTrigger>
          <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations ({evaluations.length})</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="report">Post-event report</TabsTrigger>
        </TabsList>

        <TabsContent value="booths">
          <BoothsTab eventId={event.id} booths={booths} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsTab
            eventId={event.id}
            eventDate={event.date}
            participants={participants}
            booths={booths}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="evaluations">
          <EvaluationsTab eventId={event.id} participants={participants} evaluations={evaluations} />
        </TabsContent>

        <TabsContent value="photos">
          <PhotoGallery eventId={event.id} title={`${event.name} — photo archive`} />
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent>
              {tasks.length ? (
                <ul className="divide-y divide-border">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.profiles?.full_name ?? "Unassigned"}
                          {task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">{TASK_STATUS_LABELS[task.status as TaskStatus]}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No tasks for this event"
                  description="Create tasks from the Tasks board and link them to this event."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {Number(event.budget ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Paid amount</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {Number(event.paid_amount ?? 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">Sponsor contribution</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {sponsorTotal.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Sponsors</CardTitle>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setSponsorOpen(true)}>
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {sponsors.length ? (
                  <ul className="divide-y divide-border">
                    {sponsors.map((sponsor) => {
                      const s = sponsor as {
                        id: string
                        sponsor_name: string
                        contribution_amount: number | null
                      }
                      return (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                          <p className="text-sm font-medium text-foreground">{s.sponsor_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {Number(s.contribution_amount ?? 0).toLocaleString()}
                            </span>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove sponsor"
                                onClick={() =>
                                  deleteSponsor.mutate({ sponsorId: s.id, eventId: event.id })
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <EmptyState title="No sponsors yet" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Guests</CardTitle>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setGuestOpen(true)}>
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {guests.length ? (
                  <ul className="divide-y divide-border">
                    {guests.map((guest) => {
                      const g = guest as { id: string; guest_name: string; role_or_title: string | null }
                      return (
                        <li key={g.id} className="flex items-center justify-between gap-2 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-foreground">{g.guest_name}</p>
                            {g.role_or_title && (
                              <p className="text-xs text-muted-foreground">{g.role_or_title}</p>
                            )}
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove guest"
                              onClick={() => deleteGuest.mutate({ guestId: g.id, eventId: event.id })}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <EmptyState title="No guests yet" />
                )}
              </CardContent>
            </Card>
          </div>

          {event.financial_notes && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Financial notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground">{event.financial_notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {participants.length} participants · {totalHours.toFixed(1)} volunteer hours ·{" "}
                {evaluations.length} evaluations
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  exportToExcel(
                    participants,
                    participantExportColumns,
                    `event-report-${event.name.replaceAll(" ", "-").toLowerCase()}`
                  )
                }
              >
                <Download className="size-4" />
                Export participation report
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Post-event summary</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="r-well">What went well</FieldLabel>
                  <Textarea
                    id="r-well"
                    rows={3}
                    disabled={!isAdmin}
                    value={reportNotes?.went_well ?? event.what_went_well ?? ""}
                    onChange={(e) =>
                      setReportNotes({
                        went_well: e.target.value,
                        improve: reportNotes?.improve ?? event.what_needs_improvement ?? "",
                        notes: reportNotes?.notes ?? event.post_event_notes ?? "",
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="r-improve">What needs improvement</FieldLabel>
                  <Textarea
                    id="r-improve"
                    rows={3}
                    disabled={!isAdmin}
                    value={reportNotes?.improve ?? event.what_needs_improvement ?? ""}
                    onChange={(e) =>
                      setReportNotes({
                        went_well: reportNotes?.went_well ?? event.what_went_well ?? "",
                        improve: e.target.value,
                        notes: reportNotes?.notes ?? event.post_event_notes ?? "",
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="r-notes">General notes</FieldLabel>
                  <Textarea
                    id="r-notes"
                    rows={3}
                    disabled={!isAdmin}
                    value={reportNotes?.notes ?? event.post_event_notes ?? ""}
                    onChange={(e) =>
                      setReportNotes({
                        went_well: reportNotes?.went_well ?? event.what_went_well ?? "",
                        improve: reportNotes?.improve ?? event.what_needs_improvement ?? "",
                        notes: e.target.value,
                      })
                    }
                  />
                </Field>
                {isAdmin && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveReport} disabled={!reportNotes || saveEvent.isPending}>
                      {saveEvent.isPending ? "Saving…" : "Save report"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={{
          ...event,
          event_booths: booths.map((b) => ({ id: b.id })),
          event_participants: participants.map((p) => ({ id: p.id })),
        }}
      />

      {/* Add sponsor */}
      <Dialog open={sponsorOpen} onOpenChange={setSponsorOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add sponsor</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="s-name">Sponsor name *</FieldLabel>
              <Input id="s-name" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-amount">Contribution amount</FieldLabel>
              <Input
                id="s-amount"
                type="number"
                min="0"
                step="0.01"
                value={sponsorAmount}
                onChange={(e) => setSponsorAmount(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSponsorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSponsor} disabled={saveSponsor.isPending}>
              Add sponsor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add guest */}
      <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add guest</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="g-name">Guest name *</FieldLabel>
              <Input id="g-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-role">Role / title</FieldLabel>
              <Input id="g-role" value={guestRole} onChange={(e) => setGuestRole(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGuestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGuest} disabled={saveGuest.isPending}>
              Add guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
