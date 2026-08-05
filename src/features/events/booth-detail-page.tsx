import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ClipboardCheck, MapPin, Store, Trash2, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useVolunteers } from "@/features/volunteers/use-volunteers"
import { useEventDetail, useRemoveParticipant, useSaveParticipant } from "./use-events"
import { PhotoGallery } from "./photo-gallery"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function BoothDetailPage() {
  const { id: eventId, boothId } = useParams()
  const { profile } = useAuth()
  const { data, isLoading } = useEventDetail(eventId)
  const { data: allVolunteers = [] } = useVolunteers()
  const saveParticipant = useSaveParticipant()
  const removeParticipant = useRemoveParticipant()

  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // is this user a leader of THIS booth? (drives what they may change)
  const { data: leadsThisBooth = false } = useQuery({
    queryKey: ["leads-booth", boothId, profile?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("booth_leaders")
        .select("id")
        .eq("booth_id", boothId!)
        .eq("user_id", profile!.id)
      if (error) throw error
      return (rows ?? []).length > 0
    },
    enabled: !!boothId && !!profile,
  })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const canManage = isAdmin || leadsThisBooth

  const booth = data?.booths.find((b) => b.id === boothId)
  const boothParticipants = useMemo(
    () => (data?.participants ?? []).filter((p) => p.booth_id === boothId),
    [data?.participants, boothId]
  )

  const available = useMemo(() => {
    const assigned = new Set((data?.participants ?? []).map((p) => p.volunteer_id))
    const term = search.trim().toLowerCase()
    return allVolunteers
      .filter((v) => !assigned.has(v.id))
      .filter((v) => !term || v.full_name.toLowerCase().includes(term))
  }, [allVolunteers, data?.participants, search])

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!booth) {
    return (
      <EmptyState
        title="Booth not found"
        description="It may have been removed, or you don't have access to it."
        icon={Store}
      />
    )
  }

  async function handleAddVolunteers() {
    if (!eventId || !boothId || !selectedIds.length) return
    try {
      for (const volunteerId of selectedIds) {
        const volunteer = allVolunteers.find((v) => v.id === volunteerId)
        await saveParticipant.mutateAsync({
          participant: {
            volunteer_id: volunteerId,
            booth_id: boothId,
            department_id: volunteer?.primary_department_id ?? null,
            participation_status: "confirmed",
          },
          eventId,
        })
      }
      toast.success(
        `${selectedIds.length} volunteer${selectedIds.length === 1 ? "" : "s"} added to ${booth!.name}`
      )
      setSelectedIds([])
      setSearch("")
      setAddOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add volunteers")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to={`/events/${eventId}`} />}>
          <ArrowLeft className="size-4" />
          Back to event
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Store className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{booth.name}</h1>
              {booth.description && (
                <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{booth.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {boothParticipants.length} volunteers
                </span>
                {booth.location_in_event && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {booth.location_in_event}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {booth.booth_leaders.length ? (
                  booth.booth_leaders.map((bl) => (
                    <Badge key={bl.id} variant="secondary" className="text-xs">
                      Leader: {bl.profiles.full_name}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    No leader assigned
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {canManage && (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4" />
              Add volunteers
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="volunteers">
        <TabsList>
          <TabsTrigger value="volunteers">Volunteers ({boothParticipants.length})</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="volunteers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booth volunteers</CardTitle>
            </CardHeader>
            <CardContent>
              {boothParticipants.length === 0 ? (
                <EmptyState
                  title="No volunteers in this booth yet"
                  description={canManage ? "Use “Add volunteers” to assign them." : undefined}
                  icon={Users}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {boothParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="group relative flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center"
                    >
                      <Avatar className="size-14">
                        {participant.volunteers?.photo_url && (
                          <AvatarImage src={participant.volunteers.photo_url} />
                        )}
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {participant.volunteers ? initials(participant.volunteers.full_name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-foreground">
                        {participant.volunteers?.full_name ?? "—"}
                      </p>
                      {participant.role_description && (
                        <p className="text-xs text-muted-foreground">
                          {participant.role_description}
                        </p>
                      )}
                      {canManage && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove from booth"
                          className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() =>
                            removeParticipant.mutate({
                              participantId: participant.id,
                              eventId: eventId!,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ClipboardCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {data.evaluations.filter((ev) => ev.booth_id === boothId).length} of{" "}
                  {boothParticipants.length} volunteers evaluated
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Evaluations open on their own page so you get the full form for each volunteer.
                </p>
              </div>
              <Button
                render={<Link to={`/evaluations/${eventId}/booth/${boothId}`} />}
                disabled={boothParticipants.length === 0}
              >
                <ClipboardCheck className="size-4" />
                Evaluate this booth
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <PhotoGallery
            eventId={eventId!}
            boothId={boothId!}
            canUpload={canManage}
            title={`${booth.name} photos`}
          />
        </TabsContent>
      </Tabs>

      {/* add volunteers */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add volunteers to {booth.name}</DialogTitle>
            <DialogDescription>
              Pick volunteers to assign to this booth. They'll appear in the event's participants
              list too.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {available.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No available volunteers match.
              </p>
            ) : (
              available.map((volunteer) => (
                <label
                  key={volunteer.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedIds.includes(volunteer.id)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((prev) =>
                        checked ? [...prev, volunteer.id] : prev.filter((id) => id !== volunteer.id)
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
            <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddVolunteers}
                disabled={!selectedIds.length || saveParticipant.isPending}
              >
                {saveParticipant.isPending ? "Adding…" : "Add to booth"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
