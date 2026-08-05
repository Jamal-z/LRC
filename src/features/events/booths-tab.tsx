import { useState } from "react"
import { Link } from "react-router-dom"
import { Pencil, Plus, Store, Trash2, UserCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAdminUsers } from "@/features/departments/use-department-details"
import { useDeleteBooth, useSaveBooth, useSetBoothLeaders, type BoothWithDetails } from "./use-events"

const BOOTH_SUGGESTIONS = [
  "Culture Booth", "Games Booth", "Registration Booth", "Hospitality Booth",
  "Reception Booth", "Photography Booth", "Children's Booth", "Language Booth",
  "Center Information Booth", "Food Booth", "Art Booth", "Music Booth",
]

export function BoothsTab({
  eventId,
  booths,
  isAdmin,
}: {
  eventId: string
  booths: BoothWithDetails[]
  isAdmin: boolean
}) {
  const saveBooth = useSaveBooth()
  const deleteBooth = useDeleteBooth()
  const setLeaders = useSetBoothLeaders()
  const { data: users = [] } = useAdminUsers()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BoothWithDetails | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")

  const [leadersOpen, setLeadersOpen] = useState(false)
  const [leadersBooth, setLeadersBooth] = useState<BoothWithDetails | null>(null)
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([])

  function openAdd(suggestion?: string) {
    setEditing(null)
    setName(suggestion ?? "")
    setDescription("")
    setLocation("")
    setFormOpen(true)
  }

  function openEdit(booth: BoothWithDetails) {
    setEditing(booth)
    setName(booth.name)
    setDescription(booth.description ?? "")
    setLocation(booth.location_in_event ?? "")
    setFormOpen(true)
  }

  async function handleSave() {
    if (name.trim().length < 2) {
      toast.error("Booth name is required")
      return
    }
    try {
      await saveBooth.mutateAsync({
        booth: {
          ...(editing ? { id: editing.id } : {}),
          name: name.trim(),
          description: description || null,
          location_in_event: location || null,
        },
        eventId,
      })
      toast.success(editing ? "Booth updated" : "Booth added")
      setFormOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save booth")
    }
  }

  async function handleDelete(booth: BoothWithDetails) {
    try {
      await deleteBooth.mutateAsync({ boothId: booth.id, eventId })
      toast.success(`${booth.name} removed`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete booth")
    }
  }

  function openLeaders(booth: BoothWithDetails) {
    setLeadersBooth(booth)
    setSelectedLeaderIds(booth.booth_leaders.map((bl) => bl.user_id))
    setLeadersOpen(true)
  }

  async function handleSaveLeaders() {
    if (!leadersBooth) return
    try {
      await setLeaders.mutateAsync({
        boothId: leadersBooth.id,
        userIds: selectedLeaderIds,
        eventId,
      })
      toast.success("Booth leaders updated")
      setLeadersOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update leaders")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => openAdd()}>
            <Plus className="size-4" />
            Add booth
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {BOOTH_SUGGESTIONS.filter(
              (s) => !booths.some((b) => b.name.toLowerCase() === s.toLowerCase())
            )
              .slice(0, 6)
              .map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => openAdd(suggestion)}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    + {suggestion}
                  </Badge>
                </button>
              ))}
          </div>
        </div>
      )}

      {booths.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No booths yet"
              description="Booths are created per event — add one or pick a suggestion above."
              icon={Store}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {booths.map((booth) => (
            <Card key={booth.id}>
              <CardContent className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Store className="size-4" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit booth" onClick={() => openEdit(booth)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete booth"
                        onClick={() => handleDelete(booth)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Link
                    to={`/events/${eventId}/booths/${booth.id}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {booth.name}
                  </Link>
                  {booth.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {booth.description}
                    </p>
                  )}
                  {booth.location_in_event && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Location: {booth.location_in_event}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">
                    {booth.event_participants.length} volunteers assigned
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {booth.booth_leaders.length ? (
                      booth.booth_leaders.map((bl) => (
                        <Badge key={bl.id} variant="secondary" className="text-xs">
                          {bl.profiles.full_name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        No leader yet
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    render={<Link to={`/events/${eventId}/booths/${booth.id}`} />}
                  >
                    <Store className="size-3.5" />
                    Open booth
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => openLeaders(booth)}>
                      <UserCog className="size-3.5" />
                      Manage leaders
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/edit booth dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit booth" : "Add booth"}</DialogTitle>
            <DialogDescription>Booths are specific to this event.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="b-name">Booth name *</FieldLabel>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="b-desc">Description</FieldLabel>
              <Textarea
                id="b-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="b-loc">Location in event</FieldLabel>
              <Input
                id="b-loc"
                placeholder="e.g. Main hall, corner A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveBooth.isPending}>
              {saveBooth.isPending ? "Saving…" : editing ? "Save changes" : "Add booth"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booth leaders dialog */}
      <Dialog open={leadersOpen} onOpenChange={setLeadersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booth leaders — {leadersBooth?.name}</DialogTitle>
            <DialogDescription>
              Booth leaders can see and evaluate only the volunteers assigned to this booth.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {users.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selectedLeaderIds.includes(user.id)}
                  onCheckedChange={(checked) =>
                    setSelectedLeaderIds((prev) =>
                      checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                    )
                  }
                />
                <span className="flex-1">{user.full_name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLeadersOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLeaders} disabled={setLeaders.isPending}>
              {setLeaders.isPending ? "Saving…" : "Save leaders"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
