import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  LifeBuoy,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  Star,
  UserRoundCheck,
} from "lucide-react"
import { useVolunteer } from "./use-volunteers"
import { evaluationAverage, useVolunteerHistory } from "./use-volunteer-history"
import { VolunteerFormDialog } from "./volunteer-form-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import {
  PARTICIPATION_STATUS_LABELS,
  TASK_STATUS_LABELS,
  VOLUNTEER_STATUS_BADGE,
  VOLUNTEER_STATUS_LABELS,
} from "@/lib/constants"
import type { ParticipationStatus, TaskStatus } from "@/types/database.types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function Rating({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      {value}/5
    </span>
  )
}

export function VolunteerProfilePage() {
  const { id } = useParams()
  const { data: volunteer, isLoading } = useVolunteer(id)
  const { data: history } = useVolunteerHistory(id)
  const [editOpen, setEditOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!volunteer) {
    return (
      <EmptyState
        title="Volunteer not found"
        description="They may have been removed, or you don't have access."
      />
    )
  }

  const secondaryDepts = volunteer.volunteer_departments.filter((vd) => !vd.is_primary)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/volunteers" />}>
          <ArrowLeft className="size-4" />
          Back to volunteers
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-5">
          <button
            type="button"
            onClick={() => volunteer.photo_url && setPhotoOpen(true)}
            className={volunteer.photo_url ? "cursor-zoom-in transition-transform hover:scale-105" : "cursor-default"}
            aria-label={volunteer.photo_url ? "View photo" : undefined}
            title={volunteer.photo_url ? "View photo" : undefined}
          >
            <Avatar className="size-20 ring-2 ring-transparent transition-shadow hover:ring-primary/40">
              {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
              <AvatarFallback className="bg-accent text-xl text-accent-foreground">
                {initials(volunteer.full_name)}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="min-w-52 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {volunteer.full_name}
              </h1>
              <Badge className={VOLUNTEER_STATUS_BADGE[volunteer.status]}>
                {VOLUNTEER_STATUS_LABELS[volunteer.status]}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {volunteer.volunteer_private?.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {volunteer.volunteer_private?.phone}
                </span>
              )}
              {volunteer.volunteer_private?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {volunteer.volunteer_private?.email}
                </span>
              )}
              {volunteer.volunteer_private?.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {volunteer.volunteer_private?.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Joined{" "}
                {new Date(volunteer.join_date).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> {history?.totalShifts ?? 0} shifts
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {volunteer.departments && (
                <Badge variant="secondary">{volunteer.departments.name} (primary)</Badge>
              )}
              {secondaryDepts.map((vd) => (
                <Badge key={vd.department_id} variant="outline">
                  {vd.departments.name}
                </Badge>
              ))}
              {history?.flags.potentialLeader && (
                <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <UserRoundCheck className="size-3" />
                  Potential booth leader
                </Badge>
              )}
              {history?.flags.talented && (
                <Badge className="gap-1 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <Sparkles className="size-3" />
                  Talented
                </Badge>
              )}
              {history?.flags.needsFollowUp && (
                <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <LifeBuoy className="size-3" />
                  Needs follow-up
                </Badge>
              )}
            </div>

            {volunteer.volunteer_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {volunteer.volunteer_tags.map((vt) => (
                  <Badge
                    key={vt.tag_id}
                    variant="outline"
                    style={{ borderColor: vt.tags.color, color: vt.tags.color }}
                  >
                    {vt.tags.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </CardContent>
      </Card>

      {/* headline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Cumulative rating</p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-foreground">
              <Star className="size-5 fill-amber-400 text-amber-400" />
              {history?.cumulativeAverage != null
                ? `${history.cumulativeAverage.toFixed(1)}/5`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total shifts</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {history?.totalShifts ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Events joined</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {history?.eventsCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Evaluations</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {history?.evaluations.length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">University ID</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {volunteer.volunteer_private?.university_id || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Major</p>
            <p className="mt-1 text-sm font-medium text-foreground">{volunteer.volunteer_private?.major || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Skills</p>
            <p className="mt-1 text-sm font-medium text-foreground">{volunteer.volunteer_private?.skills || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Languages</p>
            {volunteer.volunteer_private?.languages ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {volunteer.volunteer_private?.languages
                  .split(/[,،\n\/]+/)
                  .map((lang) => lang.trim())
                  .filter(Boolean)
                  .map((lang) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Availability</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {volunteer.volunteer_private?.availability || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="participation">
        <TabsList>
          <TabsTrigger value="participation">Event Participation</TabsTrigger>
          <TabsTrigger value="event-evals">Evaluations</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="participation">
          <Card>
            <CardContent>
              {history?.participations.length ? (
                <ul className="divide-y divide-border">
                  {history.participations.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {p.events?.name ?? "Event"}
                          {p.event_booths && (
                            <span className="text-muted-foreground"> · {p.event_booths.name}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.events?.date && new Date(p.events.date).toLocaleDateString()}
                          {p.role_description ? ` · ${p.role_description}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {PARTICIPATION_STATUS_LABELS[p.participation_status as ParticipationStatus]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No event participation yet"
                  description="Once this volunteer joins an event, it will show here."
                  icon={CalendarDays}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="event-evals">
          <Card>
            <CardContent>
              {history?.evaluations.length ? (
                <ul className="divide-y divide-border">
                  {history.evaluations.map((ev) => {
                    const average = evaluationAverage(ev)
                    return (
                      <li key={ev.id} className="py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {ev.events?.name ?? "Event"}
                            {(ev.event_booths || ev.departments) && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {ev.event_booths?.name ?? ev.departments?.name}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {ev.shifts_count} shifts
                            </Badge>
                            {average != null && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                {average.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                          <span>
                            Meetings: <Rating value={ev.meeting_attendance_rating} />
                          </span>
                          <span>
                            Performance: <Rating value={ev.performance_rating} />
                          </span>
                          <span>
                            Teamwork: <Rating value={ev.teamwork_rating} />
                          </span>
                          <span>
                            Communication: <Rating value={ev.communication_rating} />
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {ev.potential_future_booth_leader && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <UserRoundCheck className="size-3" />
                              Potential booth leader
                            </Badge>
                          )}
                          {ev.is_talented && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Sparkles className="size-3" />
                              Talented
                            </Badge>
                          )}
                          {ev.needs_follow_up && (
                            <Badge className="gap-1 bg-amber-100 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              <LifeBuoy className="size-3" />
                              Needs follow-up
                            </Badge>
                          )}
                        </div>

                        {ev.notes && (
                          <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
                            {ev.notes}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          by {ev.profiles?.full_name ?? "—"} ·{" "}
                          {new Date(ev.created_at).toLocaleDateString()}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  title="No evaluations yet"
                  description="Booth and team leader evaluations will show here after each event."
                  icon={Star}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardContent>
              {history?.tasks.length ? (
                <ul className="divide-y divide-border">
                  {history.tasks.map((task) => (
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
                  title="No tasks linked"
                  description="Tasks assigned to or related to this volunteer will show here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent>
              {volunteer.volunteer_private?.internal_notes ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {volunteer.volunteer_private?.internal_notes}
                </p>
              ) : (
                <EmptyState title="No notes" description="Use Edit to add internal notes." />
              )}
              {(volunteer.volunteer_private?.emergency_contact_name || volunteer.volunteer_private?.emergency_contact_phone) && (
                <div className="mt-4 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Emergency contact
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {volunteer.volunteer_private?.emergency_contact_name}
                    {volunteer.volunteer_private?.emergency_contact_phone && ` · ${volunteer.volunteer_private?.emergency_contact_phone}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <VolunteerFormDialog open={editOpen} onOpenChange={setEditOpen} volunteer={volunteer} />

      {/* photo lightbox */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <DialogTitle className="sr-only">{volunteer.full_name}</DialogTitle>
          {volunteer.photo_url && (
            <img
              src={volunteer.photo_url}
              alt={volunteer.full_name}
              className="max-h-[80svh] w-full object-contain"
            />
          )}
          <p className="px-4 pb-3 text-center text-sm font-medium text-foreground">
            {volunteer.full_name}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
