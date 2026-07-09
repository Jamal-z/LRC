import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Pencil, Plus, Tags, Trash2, UploadCloud, X } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTags } from "@/features/volunteers/use-volunteers"
import { useDepartments } from "@/features/departments/use-departments"
import {
  LOGIN_PAGE_PHOTOS_SETTING_KEY,
  saveLoginPagePhotos,
  useLoginPagePhotos,
  type LoginPagePhoto,
} from "@/features/settings/use-login-page-photos"
import type { DepartmentRow, TagRow } from "@/types/database.types"

const TAG_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#16a34a",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#6366f1",
]

type PhotoDraft = {
  positionX: number
  positionY: number
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: tags = [] } = useTags()
  const { data: departments = [] } = useDepartments()
  const { data: loginPagePhotos = [] } = useLoginPagePhotos()

  // ----- tags -----
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagRow | null>(null)
  const [tagName, setTagName] = useState("")
  const [tagColor, setTagColor] = useState(TAG_COLORS[0])

  const saveTag = useMutation({
    mutationFn: async () => {
      if (editingTag) {
        const { error } = await supabase
          .from("tags")
          .update({ name: tagName.trim(), color: tagColor })
          .eq("id", editingTag.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("tags").insert({
          name: tagName.trim(),
          color: tagColor,
        })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success(editingTag ? "Tag updated" : "Tag added")
      setTagDialogOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success("Tag deleted")
    },
    onError: (error) => toast.error(error.message),
  })

  // ----- departments -----
  const [deptDialogOpen, setDeptDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null)
  const [deptName, setDeptName] = useState("")
  const [deptDescription, setDeptDescription] = useState("")
  const [deptMonthlyEval, setDeptMonthlyEval] = useState(true)
  const [deptImageFile, setDeptImageFile] = useState<File | null>(null)
  const [deptImagePreview, setDeptImagePreview] = useState<string | null>(null)
  const deptImageInputRef = useRef<HTMLInputElement>(null)

  const saveDepartment = useMutation({
    mutationFn: async () => {
      let imageUrl = editingDept?.image_url ?? null

      if (deptImageFile) {
        const ext = deptImageFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `departments/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, deptImageFile, { upsert: true })

        if (uploadError) throw uploadError

        imageUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
      }

      const payload = {
        name: deptName.trim(),
        description: deptDescription || null,
        requires_monthly_evaluation: deptMonthlyEval,
        image_url: imageUrl,
      }

      if (editingDept) {
        const { error } = await supabase.from("departments").update(payload).eq("id", editingDept.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("departments").insert(payload)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      queryClient.invalidateQueries({ queryKey: ["department-summaries"] })
      toast.success(editingDept ? "Department updated" : "Department added")
      setDeptDialogOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  // ----- login page photos -----
  const loginPhotoInputRef = useRef<HTMLInputElement>(null)
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, PhotoDraft>>({})

  const uploadLoginPhoto = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `login-page/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl

      const newPhoto: LoginPagePhoto = {
        url,
        path,
        alt: "LRC group photo",
        created_at: new Date().toISOString(),
        positionX: 50,
        positionY: 50,
      }

      await saveLoginPagePhotos([...loginPagePhotos, newPhoto])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-setting", LOGIN_PAGE_PHOTOS_SETTING_KEY] })
      toast.success("Login page photo added")
    },
    onError: (error) => toast.error(error.message),
  })

  const removeLoginPhoto = useMutation({
    mutationFn: async (photo: LoginPagePhoto) => {
      await saveLoginPagePhotos(loginPagePhotos.filter((item) => item.path !== photo.path))

      const { error } = await supabase.storage.from("avatars").remove([photo.path])

      if (error) throw error
    },
    onSuccess: (_data, photo) => {
      setPhotoDrafts((current) => {
        const copy = { ...current }
        delete copy[photo.path]
        return copy
      })

      queryClient.invalidateQueries({ queryKey: ["app-setting", LOGIN_PAGE_PHOTOS_SETTING_KEY] })
      toast.success("Login page photo removed")
    },
    onError: (error) => toast.error(error.message),
  })

  const updateLoginPhoto = useMutation({
    mutationFn: async ({
      photo,
      positionX,
      positionY,
    }: {
      photo: LoginPagePhoto
      positionX: number
      positionY: number
    }) => {
      const updatedPhotos = loginPagePhotos.map((item) =>
        item.path === photo.path
          ? {
              ...item,
              positionX,
              positionY,
            }
          : item
      )

      await saveLoginPagePhotos(updatedPhotos)
    },
    onSuccess: (_data, variables) => {
      setPhotoDrafts((current) => {
        const copy = { ...current }
        delete copy[variables.photo.path]
        return copy
      })

      queryClient.invalidateQueries({ queryKey: ["app-setting", LOGIN_PAGE_PHOTOS_SETTING_KEY] })
      toast.success("Photo display updated")
    },
    onError: (error) => toast.error(error.message),
  })

  function openTagDialog(tag?: TagRow) {
    setEditingTag(tag ?? null)
    setTagName(tag?.name ?? "")
    setTagColor(tag?.color ?? TAG_COLORS[0])
    setTagDialogOpen(true)
  }

  function openDeptDialog(dept?: DepartmentRow) {
    setEditingDept(dept ?? null)
    setDeptName(dept?.name ?? "")
    setDeptDescription(dept?.description ?? "")
    setDeptMonthlyEval(dept?.requires_monthly_evaluation ?? true)
    setDeptImageFile(null)
    setDeptImagePreview(null)
    setDeptDialogOpen(true)
  }

  function getPhotoDraft(photo: LoginPagePhoto): PhotoDraft {
    return (
      photoDrafts[photo.path] ?? {
        positionX: photo.positionX ?? 50,
        positionY: photo.positionY ?? 50,
      }
    )
  }

  function updatePhotoDraft(photo: LoginPagePhoto, changes: Partial<PhotoDraft>) {
    const current = getPhotoDraft(photo)

    setPhotoDrafts((drafts) => ({
      ...drafts,
      [photo.path]: {
        ...current,
        ...changes,
      },
    }))
  }

  function hasPhotoDraft(photo: LoginPagePhoto) {
    const draft = photoDrafts[photo.path]

    if (!draft) return false

    return draft.positionX !== (photo.positionX ?? 50) || draft.positionY !== (photo.positionY ?? 50)
  }

  function resetPhotoDraft(photo: LoginPagePhoto) {
    setPhotoDrafts((current) => {
      const copy = { ...current }
      delete copy[photo.path]
      return copy
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage tags, departments, login photos and app preferences.
        </p>
      </div>

      <Tabs defaultValue="tags">
        <TabsList>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="login-photos">Login page photos</TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Volunteer tags</CardTitle>
                <CardDescription>
                  Flexible labels used on volunteer profiles and evaluations.
                </CardDescription>
              </div>

              <Button size="sm" onClick={() => openTagDialog()}>
                <Plus className="size-4" />
                Add tag
              </Button>
            </CardHeader>

            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-1.5 rounded-full border border-border py-1 pr-1.5 pl-3"
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm text-foreground">{tag.name}</span>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Edit ${tag.name}`}
                      onClick={() => openTagDialog(tag)}
                    >
                      <Pencil className="size-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${tag.name}`}
                      onClick={() => deleteTag.mutate(tag.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}

                {!tags.length && (
                  <p className="text-sm text-muted-foreground">
                    <Tags className="mr-1 inline size-4" />
                    No tags yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Departments</CardTitle>
                <CardDescription>
                  Edit names, descriptions, and whether a department uses monthly evaluations.
                </CardDescription>
              </div>

              <Button size="sm" onClick={() => openDeptDialog()}>
                <Plus className="size-4" />
                Add department
              </Button>
            </CardHeader>

            <CardContent>
              <ul className="divide-y divide-border">
                {departments.map((dept) => (
                  <li key={dept.id} className="flex items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground">{dept.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={dept.requires_monthly_evaluation ? "secondary" : "outline"}>
                        {dept.requires_monthly_evaluation ? "Monthly eval" : "Event-based"}
                      </Badge>

                      <Button size="sm" variant="outline" onClick={() => openDeptDialog(dept)}>
                        Edit
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="login-photos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Login page photos</CardTitle>
                <CardDescription>
                  Upload group photos for the left side of the sign-in page. They will rotate
                  automatically like a slideshow. Use the sliders to adjust the crop position.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => loginPhotoInputRef.current?.click()}
                disabled={uploadLoginPhoto.isPending}
              >
                <UploadCloud className="size-4" />
                {uploadLoginPhoto.isPending ? "Uploading…" : "Add photo"}
              </Button>

              <input
                ref={loginPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (file) uploadLoginPhoto.mutate(file)

                  event.currentTarget.value = ""
                }}
              />
            </CardHeader>

            <CardContent>
              {loginPagePhotos.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {loginPagePhotos.map((photo, index) => {
                    const draft = getPhotoDraft(photo)
                    const changed = hasPhotoDraft(photo)

                    return (
                      <div key={photo.path} className="overflow-hidden rounded-2xl border bg-muted">
                        <div className="group relative">
                          <img
                            src={photo.url}
                            alt={photo.alt || `Login photo ${index + 1}`}
                            className="aspect-[4/3] w-full object-cover"
                            style={{
                              objectPosition: `${draft.positionX}% ${draft.positionY}%`,
                            }}
                          />

                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                            <span className="text-xs font-medium">Photo {index + 1}</span>

                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-white hover:bg-white/20 hover:text-white"
                              aria-label="Remove login page photo"
                              onClick={() => removeLoginPhoto.mutate(photo)}
                              disabled={removeLoginPhoto.isPending}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <Field>
                            <div className="flex items-center justify-between">
                              <FieldLabel>Horizontal position</FieldLabel>
                              <span className="text-xs text-muted-foreground">
                                {draft.positionX}%
                              </span>
                            </div>

                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={draft.positionX}
                              className="w-full"
                              onChange={(event) =>
                                updatePhotoDraft(photo, {
                                  positionX: Number(event.target.value),
                                })
                              }
                            />

                            <p className="text-xs text-muted-foreground">
                              Move the visible part left or right.
                            </p>
                          </Field>

                          <Field>
                            <div className="flex items-center justify-between">
                              <FieldLabel>Vertical position</FieldLabel>
                              <span className="text-xs text-muted-foreground">
                                {draft.positionY}%
                              </span>
                            </div>

                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={draft.positionY}
                              className="w-full"
                              onChange={(event) =>
                                updatePhotoDraft(photo, {
                                  positionY: Number(event.target.value),
                                })
                              }
                            />

                            <p className="text-xs text-muted-foreground">
                              Move the visible part up or down.
                            </p>
                          </Field>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => resetPhotoDraft(photo)}
                              disabled={!changed || updateLoginPhoto.isPending}
                            >
                              Reset
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                updateLoginPhoto.mutate({
                                  photo,
                                  positionX: draft.positionX,
                                  positionY: draft.positionY,
                                })
                              }
                              disabled={!changed || updateLoginPhoto.isPending}
                            >
                              {updateLoginPhoto.isPending ? "Saving…" : "Save position"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
                  <ImagePlus className="size-8 text-muted-foreground" />

                  <h3 className="mt-3 text-sm font-medium text-foreground">
                    No login photos yet
                  </h3>

                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Add group photos here, then the sign-in page will show them on the left side and
                    switch between them automatically.
                  </p>

                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => loginPhotoInputRef.current?.click()}
                  >
                    <UploadCloud className="size-4" />
                    Upload first photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit tag" : "Add tag"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="tag-name">Tag name *</FieldLabel>
              <Input id="tag-name" value={tagName} onChange={(e) => setTagName(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    className="size-7 rounded-full ring-offset-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        tagColor === color
                          ? `0 0 0 2px var(--background), 0 0 0 4px ${color}`
                          : undefined,
                    }}
                    onClick={() => setTagColor(color)}
                  />
                ))}
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>

            <Button
              onClick={() => saveTag.mutate()}
              disabled={tagName.trim().length < 2 || saveTag.isPending}
            >
              {saveTag.isPending ? "Saving…" : "Save tag"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit department" : "Add department"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => deptImageInputRef.current?.click()}
              className="group relative h-32 w-full overflow-hidden rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50"
            >
              {deptImagePreview || editingDept?.image_url ? (
                <img
                  src={deptImagePreview ?? editingDept?.image_url ?? undefined}
                  alt="Department"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImagePlus className="size-5" />
                  <span className="text-xs">Add department photo</span>
                </span>
              )}

              <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-xs font-medium text-white group-hover:flex">
                Change photo
              </span>
            </button>

            <input
              ref={deptImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  setDeptImageFile(file)
                  setDeptImagePreview(URL.createObjectURL(file))
                }
              }}
            />

            <Field>
              <FieldLabel htmlFor="dept-name">Name *</FieldLabel>
              <Input id="dept-name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="dept-desc">Description</FieldLabel>
              <Textarea
                id="dept-desc"
                rows={2}
                value={deptDescription}
                onChange={(e) => setDeptDescription(e.target.value)}
              />
            </Field>

            <label className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Monthly evaluations</p>
                <FieldDescription>
                  Off for departments evaluated through events only, such as Field Volunteering.
                </FieldDescription>
              </div>

              <Switch checked={deptMonthlyEval} onCheckedChange={setDeptMonthlyEval} />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>
              Cancel
            </Button>

            <Button
              onClick={() => saveDepartment.mutate()}
              disabled={deptName.trim().length < 2 || saveDepartment.isPending}
            >
              {saveDepartment.isPending ? "Saving…" : "Save department"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}