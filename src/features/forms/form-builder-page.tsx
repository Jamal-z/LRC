import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartments } from "@/features/departments/use-departments"
import { useEvents } from "@/features/events/use-events"
import {
  FIELD_MAPPINGS,
  FIELD_TYPES,
  slugify,
  useForm,
  useFormFields,
  useSaveForm,
} from "./use-forms"
import type { FormDestination, FormFieldType } from "@/types/database.types"

const NONE = "__none__"

const ACCENT_COLORS = [
  "#2563eb", "#0ea5e9", "#14b8a6", "#16a34a",
  "#f59e0b", "#f97316", "#ef4444", "#8b5cf6",
]

interface DraftField {
  key: string
  label: string
  help_text: string
  field_type: FormFieldType
  options: string[]
  is_required: boolean
  maps_to: string | null
}

function newField(): DraftField {
  return {
    key: crypto.randomUUID(),
    label: "",
    help_text: "",
    field_type: "text",
    options: [],
    is_required: false,
    maps_to: null,
  }
}

const STARTER_FIELDS: { label: string; maps_to: string; field_type: FormFieldType }[] = [
  { label: "الاسم الرباعي / Full name", maps_to: "full_name", field_type: "text" },
  { label: "الرقم الجامعي / University ID", maps_to: "university_id", field_type: "text" },
  { label: "التخصص / Major", maps_to: "major", field_type: "text" },
  { label: "رقم الواتساب / WhatsApp", maps_to: "phone", field_type: "phone" },
  { label: "مكان السكن / Residence", maps_to: "city", field_type: "text" },
]

export function FormBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isNew = !id
  const { data: existingForm, isLoading } = useForm(id)
  const { data: existingFields } = useFormFields(id)
  const { data: departments = [] } = useDepartments()
  const { data: events = [] } = useEvents()
  const saveForm = useSaveForm()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0])
  const [isActive, setIsActive] = useState(true)
  const [destination, setDestination] = useState<FormDestination>("volunteers")
  const [destinationEventId, setDestinationEventId] = useState<string>(NONE)
  const [destinationDepartmentId, setDestinationDepartmentId] = useState<string>(NONE)
  const [successMessage, setSuccessMessage] = useState("")
  const [fields, setFields] = useState<DraftField[]>([])

  useEffect(() => {
    if (isNew) {
      setFields(
        STARTER_FIELDS.map((starter) => ({
          ...newField(),
          label: starter.label,
          maps_to: starter.maps_to,
          field_type: starter.field_type,
          is_required: true,
        }))
      )
      return
    }
    if (existingForm) {
      setTitle(existingForm.title)
      setDescription(existingForm.description ?? "")
      setAccentColor(existingForm.accent_color)
      setIsActive(existingForm.is_active)
      setDestination(existingForm.destination)
      setDestinationEventId(existingForm.destination_event_id ?? NONE)
      setDestinationDepartmentId(existingForm.destination_department_id ?? NONE)
      setSuccessMessage(existingForm.success_message ?? "")
    }
  }, [isNew, existingForm])

  useEffect(() => {
    if (existingFields?.length) {
      setFields(
        existingFields.map((field) => ({
          key: field.id,
          label: field.label,
          help_text: field.help_text ?? "",
          field_type: field.field_type,
          options: field.options ?? [],
          is_required: field.is_required,
          maps_to: field.maps_to,
        }))
      )
    }
  }, [existingFields])

  function updateField(key: string, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSave() {
    if (title.trim().length < 2) {
      toast.error("Give your form a title")
      return
    }
    const validFields = fields.filter((f) => f.label.trim())
    if (!validFields.length) {
      toast.error("Add at least one question")
      return
    }
    if (destination === "event_participants" && destinationEventId === NONE) {
      toast.error("Choose which event accepted people should join")
      return
    }

    try {
      const formId = await saveForm.mutateAsync({
        form: {
          ...(id ? { id } : { created_by: profile?.id ?? null, slug: slugify(title) }),
          title: title.trim(),
          description: description || null,
          accent_color: accentColor,
          is_active: isActive,
          destination,
          destination_event_id: destinationEventId === NONE ? null : destinationEventId,
          destination_department_id:
            destinationDepartmentId === NONE ? null : destinationDepartmentId,
          success_message: successMessage || null,
        },
        fields: validFields.map((f) => ({
          label: f.label.trim(),
          help_text: f.help_text || null,
          field_type: f.field_type,
          options: f.options.filter(Boolean),
          is_required: f.is_required,
          maps_to: f.maps_to,
        })),
      })
      toast.success(isNew ? "Form created" : "Form saved")
      navigate(`/forms/${formId}/responses`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the form")
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const needsOptions = (type: FormFieldType) =>
    type === "select" || type === "radio" || type === "checkbox"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/forms" />}>
          <ArrowLeft className="size-4" />
          Back to forms
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isNew ? "Create form" : "Edit form"}
        </h1>
        <Button onClick={handleSave} disabled={saveForm.isPending}>
          {saveForm.isPending ? "Saving…" : isNew ? "Create form" : "Save changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        {/* questions */}
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden pt-0">
            <div className="h-2 w-full" style={{ backgroundColor: accentColor }} aria-hidden />
            <CardContent className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="f-title">Form title *</FieldLabel>
                <Input
                  id="f-title"
                  placeholder="e.g. Volunteer registration"
                  className="h-11 text-lg font-medium"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-desc">Description</FieldLabel>
                <Textarea
                  id="f-desc"
                  rows={2}
                  placeholder="Shown under the title on the public form"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          {fields.map((field, index) => (
            <Card key={field.key}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <Input
                      placeholder={`Question ${index + 1}`}
                      value={field.label}
                      onChange={(e) => updateField(field.key, { label: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(index, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove question"
                      onClick={() => setFields((prev) => prev.filter((f) => f.key !== field.key))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Answer type</FieldLabel>
                    <Select
                      value={field.field_type}
                      onValueChange={(v) =>
                        updateField(field.key, { field_type: (v ?? "text") as FormFieldType })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Save answer into</FieldLabel>
                    <Select
                      value={field.maps_to ?? NONE}
                      onValueChange={(v) =>
                        updateField(field.key, { maps_to: v === NONE ? null : (v ?? null) })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Don't save to a field</SelectItem>
                        {FIELD_MAPPINGS.map((mapping) => (
                          <SelectItem key={mapping.value} value={mapping.value}>
                            {mapping.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Used when you accept a response.
                    </FieldDescription>
                  </Field>

                  <Field className="sm:col-span-2">
                    <FieldLabel>Helper text</FieldLabel>
                    <Input
                      placeholder="Optional hint shown under the question"
                      value={field.help_text}
                      onChange={(e) => updateField(field.key, { help_text: e.target.value })}
                    />
                  </Field>

                  {needsOptions(field.field_type) && (
                    <Field className="sm:col-span-2">
                      <FieldLabel>Choices (one per line)</FieldLabel>
                      <Textarea
                        rows={3}
                        placeholder={"Option 1\nOption 2"}
                        value={field.options.join("\n")}
                        onChange={(e) =>
                          updateField(field.key, { options: e.target.value.split("\n") })
                        }
                      />
                    </Field>
                  )}

                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <Checkbox
                      checked={field.is_required}
                      onCheckedChange={(checked) =>
                        updateField(field.key, { is_required: !!checked })
                      }
                    />
                    Required
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={() => setFields((prev) => [...prev, newField()])}>
            <Plus className="size-4" />
            Add question
          </Button>
        </div>

        {/* settings */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>How the form looks and what accepting does.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel>Accent colour</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      className="size-7 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          accentColor === color
                            ? `0 0 0 2px var(--background), 0 0 0 4px ${color}`
                            : undefined,
                      }}
                      onClick={() => setAccentColor(color)}
                    />
                  ))}
                </div>
              </Field>

              <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">Accepting responses</p>
                  <FieldDescription>Turn off to close the form.</FieldDescription>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>

              <Field>
                <FieldLabel>When I accept a response…</FieldLabel>
                <Select
                  value={destination}
                  onValueChange={(v) => setDestination((v ?? "volunteers") as FormDestination)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volunteers">Add them as a volunteer</SelectItem>
                    <SelectItem value="event_participants">
                      Add them to a specific event
                    </SelectItem>
                    <SelectItem value="none">Just keep the record</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {destination === "event_participants" && (
                <Field>
                  <FieldLabel>Event</FieldLabel>
                  <Select
                    value={destinationEventId}
                    onValueChange={(v) => setDestinationEventId(v ?? NONE)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {destination !== "none" && (
                <Field>
                  <FieldLabel>Default team</FieldLabel>
                  <Select
                    value={destinationDepartmentId}
                    onValueChange={(v) => setDestinationDepartmentId(v ?? NONE)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No default</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Used when the form doesn't ask for a team.
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="f-success">Thank-you message</FieldLabel>
                <Textarea
                  id="f-success"
                  rows={3}
                  placeholder="Shown after someone submits the form"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          {!isNew && existingForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Public link</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="block break-all rounded-lg bg-muted px-3 py-2 text-xs" dir="ltr">
                  {window.location.origin}/f/{existingForm.slug}
                </code>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
