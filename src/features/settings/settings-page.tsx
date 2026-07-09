import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Pencil, Plus, Tags, Trash2 } from "lucide-react"
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
import type { DepartmentRow, TagRow } from "@/types/database.types"

const TAG_COLORS = [
  "#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#f59e0b",
  "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1",
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: tags = [] } = useTags()
  const { data: departments = [] } = useDepartments()

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
        const { error } = await supabase.from("tags").insert({ name: tagName.trim(), color: tagColor })
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage tags, departments and app preferences.
        </p>
      </div>

      <Tabs defaultValue="tags">
        <TabsList>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
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
                      boxShadow: tagColor === color ? `0 0 0 2px var(--background), 0 0 0 4px ${color}` : undefined,
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
            <Button onClick={() => saveTag.mutate()} disabled={tagName.trim().length < 2 || saveTag.isPending}>
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
              onChange={(e) => {
                const file = e.target.files?.[0]
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
                  Off for departments evaluated through events only (e.g. Field Volunteering).
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
