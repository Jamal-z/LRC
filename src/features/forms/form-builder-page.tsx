import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Monitor,
  Palette,
  Plus,
  Wand2,
  Settings2,
  Smartphone,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  guessMapping,
  slugify,
  useForm,
  useFormFields,
  useSaveForm,
} from "./use-forms"
import {
  DEFAULT_DESIGN,
  extractFieldsFromHtml,
  resolveDesign,
  sanitizeCss,
  sanitizeHtml,
} from "./form-design"
import type { ExtractedField } from "./form-design"
import { FormDesignPanel } from "./form-design-panel"
import { FormRenderer, previewFields, type AnswerMap } from "./form-renderer"
import { PreviewFrame } from "./preview-frame"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type {
  FormDesign,
  FormDestination,
  FormFieldRow,
  FormFieldType,
} from "@/types/database.types"

const NONE = "__none__"

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
  const [accentColor, setAccentColor] = useState("#2563eb")
  const [design, setDesign] = useState<Required<FormDesign>>(DEFAULT_DESIGN)
  const [customCss, setCustomCss] = useState("")
  const [customHeaderHtml, setCustomHeaderHtml] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [isActive, setIsActive] = useState(true)
  const [destination, setDestination] = useState<FormDestination>("volunteers")
  const [destinationEventId, setDestinationEventId] = useState<string>(NONE)
  const [destinationDepartmentId, setDestinationDepartmentId] = useState<string>(NONE)
  const [successMessage, setSuccessMessage] = useState("")
  const [fields, setFields] = useState<DraftField[]>([])

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
  const [showPreview, setShowPreview] = useState(true)
  const [previewAnswers, setPreviewAnswers] = useState<AnswerMap>({})

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
      setDesign(resolveDesign(existingForm.design))
      setCustomCss(existingForm.custom_css ?? "")
      setCustomHeaderHtml(existingForm.custom_header_html ?? "")
      setCoverImageUrl(existingForm.cover_image_url)
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

  /**
   * Takes the questions found in an uploaded HTML file.
   *
   * Replaces the draft rather than appending: somebody who uploads a form they
   * wrote by hand means *that* to be the form, and ending up with their five
   * questions plus a stray empty one is nobody's intent. Existing questions are
   * only kept when the upload had none of its own.
   */
  function importFields(imported: ExtractedField[]) {
    if (!imported.length) return
    setFields(
      imported.map((field) => ({
        key: crypto.randomUUID(),
        label: field.label,
        help_text: "",
        field_type: (FIELD_TYPES.some((t) => t.value === field.field_type)
          ? field.field_type
          : "text") as FormFieldType,
        options: field.options,
        is_required: field.is_required,
        maps_to: guessMapping(field.label),
      }))
    )
  }

  /**
   * Re-reads every question title and points it at the volunteer field it is
   * asking about.
   *
   * Where an answer goes is decided once, when the questions are created, so a
   * form built before the titles were being read properly keeps whatever was
   * worked out back then — nine rows of a language grid feeding nothing, and a
   * volunteer who speaks four languages filed as speaking one. This re-runs
   * that reading over the questions as they stand now, without touching a
   * choice made by hand.
   */
  function remapFields() {
    // An uploaded form keeps its markup, so the questions can be read out of it
    // again — titles included. That matters: a grid row saved as "lvl_en" back
    // when group titles were not being found points at nothing, and no amount
    // of re-guessing from "lvl_en" will ever say "languages". Rewriting in
    // place keeps each question's id, so responses already collected still line
    // up with it — which re-uploading the file would not.
    const fromLayout =
      design.htmlLayout && customHeaderHtml ? extractFieldsFromHtml(customHeaderHtml) : []

    let changed = 0
    setFields((prev) =>
      prev.map((field, index) => {
        const source = fromLayout[index]
        const label = source?.label || field.label
        const maps_to = guessMapping(label) ?? field.maps_to
        const options = source?.options.length ? source.options : field.options
        if (label === field.label && maps_to === field.maps_to && options === field.options) {
          return field
        }
        changed++
        return { ...field, label, maps_to, options }
      })
    )

    toast.success(
      changed
        ? `${changed} question${changed === 1 ? "" : "s"} updated — press Save to keep it`
        : "Every question is already up to date"
    )
  }

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

  function patchDesign(patch: Partial<Required<FormDesign>>) {
    // any hand tweak means this is no longer exactly one of the presets
    setDesign((prev) => ({ ...prev, ...patch, preset: patch.preset ?? "custom" }))
  }

  /** What the preview renders: the real questions, or a sample set while empty. */
  const previewForm = useMemo(
    () => ({
      title: title || "Untitled form",
      description: description || null,
      accent_color: accentColor,
      cover_image_url: coverPreview ?? coverImageUrl,
      success_message: successMessage || null,
      design,
      custom_css: customCss,
      custom_header_html: customHeaderHtml,
    }),
    [
      title,
      description,
      accentColor,
      coverPreview,
      coverImageUrl,
      successMessage,
      design,
      customCss,
      customHeaderHtml,
    ]
  )

  const previewFieldRows: FormFieldRow[] = useMemo(() => {
    const real = fields.filter((f) => f.label.trim())
    if (!real.length) return previewFields()
    return real.map((f, index) => ({
      id: f.key,
      form_id: "preview",
      label: f.label,
      help_text: f.help_text || null,
      field_type: f.field_type,
      options: f.options.filter(Boolean),
      is_required: f.is_required,
      position: index,
      maps_to: f.maps_to,
      created_at: "",
    }))
  }, [fields])

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
      let coverUrl = coverImageUrl
      if (coverFile) {
        const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `forms/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, coverFile, { upsert: true })
        if (uploadError) throw uploadError
        coverUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
      }

      const formId = await saveForm.mutateAsync({
        form: {
          ...(id ? { id } : { created_by: profile?.id ?? null, slug: slugify(title) }),
          title: title.trim(),
          description: description || null,
          accent_color: accentColor,
          design,
          // the public page renders these, so strip anything executable first
          custom_css: customCss.trim() ? sanitizeCss(customCss) : null,
          custom_header_html: customHeaderHtml.trim() ? sanitizeHtml(customHeaderHtml) : null,
          cover_image_url: coverUrl,
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

  // encodeURIComponent so a legacy non-ASCII slug still copies and opens cleanly
  const publicUrl = existingForm
    ? `${window.location.origin}/f/${encodeURIComponent(existingForm.slug)}`
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* pinned: a custom skin used to be able to push this off the page, and a
          builder you cannot save from is a builder that loses work */}
      <div className="sticky top-0 z-30 -mx-1 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link to="/forms" />}>
            <ArrowLeft className="size-4" />
            Back to forms
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isNew ? "Create form" : "Edit form"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <Button
              variant="outline"
              size="sm"
              render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Open live form
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((shown) => !shown)}
          >
            {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showPreview ? "Hide preview" : "Show preview"}
          </Button>
          <Button onClick={handleSave} disabled={saveForm.isPending}>
            {saveForm.isPending ? "Saving…" : isNew ? "Create form" : "Save changes"}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          showPreview && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
        )}
      >
        {/* ---------------- editor ---------------- */}
        <div className="min-w-0">
          <Tabs defaultValue="questions">
            <TabsList className="w-full">
              <TabsTrigger value="questions" className="flex-1">
                <GripVertical className="size-4" />
                Questions
              </TabsTrigger>
              <TabsTrigger value="design" className="flex-1">
                <Palette className="size-4" />
                Design
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <Settings2 className="size-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* questions */}
            <TabsContent value="questions" className="flex flex-col gap-3 pt-3">
              <Card className="overflow-hidden pt-0">
                <div
                  className="h-2 w-full"
                  style={{ background: `linear-gradient(90deg, ${accentColor}, ${design.accentTo})` }}
                  aria-hidden
                />
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
                      <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
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
                          aria-label="Duplicate question"
                          onClick={() =>
                            setFields((prev) => [
                              ...prev.slice(0, index + 1),
                              { ...field, key: crypto.randomUUID() },
                              ...prev.slice(index + 1),
                            ])
                          }
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove question"
                          onClick={() =>
                            setFields((prev) => prev.filter((f) => f.key !== field.key))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          Used when you accept a response, and to pre-fill an interview.
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

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setFields((prev) => [...prev, newField()])}>
                  <Plus className="size-4" />
                  Add question
                </Button>
                {fields.length > 1 && (
                  <Button variant="ghost" onClick={remapFields}>
                    <Wand2 className="size-4" />
                    Re-read the questions
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* design */}
            <TabsContent value="design" className="pt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Form design</CardTitle>
                  <CardDescription>
                    Every change shows up in the live preview straight away.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormDesignPanel
                    design={design}
                    onChange={patchDesign}
                    onReplace={setDesign}
                    accentColor={accentColor}
                    onAccentColor={setAccentColor}
                    customCss={customCss}
                    onCustomCss={setCustomCss}
                    customHeaderHtml={customHeaderHtml}
                    onCustomHeaderHtml={setCustomHeaderHtml}
                    formTitle={title}
                    onImportFields={importFields}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* settings */}
            <TabsContent value="settings" className="flex flex-col gap-4 pt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cover image</CardTitle>
                  <CardDescription>
                    How big it appears is set under Design → Cover.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="group relative h-40 w-full overflow-hidden rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50"
                  >
                    {coverPreview || coverImageUrl ? (
                      <img
                        src={coverPreview ?? coverImageUrl ?? undefined}
                        alt="Form cover"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <ImagePlus className="size-6" />
                        <span className="text-xs">Add a cover image</span>
                      </span>
                    )}
                    <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-xs font-medium text-white group-hover:flex">
                      Change image
                    </span>
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setCoverFile(file)
                        setCoverPreview(URL.createObjectURL(file))
                      }
                    }}
                  />
                  {(coverPreview || coverImageUrl) && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="self-start"
                      onClick={() => {
                        setCoverFile(null)
                        setCoverPreview(null)
                        setCoverImageUrl(null)
                      }}
                    >
                      Remove image
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Responses</CardTitle>
                  <CardDescription>What accepting a response does.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
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
                        <SelectItem value="renew_volunteers">
                          Renew an existing volunteer
                        </SelectItem>
                        <SelectItem value="event_participants">
                          Add them to a specific event
                        </SelectItem>
                        <SelectItem value="none">Just keep the record</SelectItem>
                      </SelectContent>
                    </Select>
                    {destination === "renew_volunteers" && (
                      <FieldDescription>
                        For a renewal form: nobody new is ever created. We find the volunteer by
                        university ID, phone, then name — fill in whatever was blank, leave
                        identical answers alone, and update changed ones while keeping the old
                        value in their notes. If nobody matches, the response is flagged for you
                        instead.
                      </FieldDescription>
                    )}
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

              {publicUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Public link</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <code
                      className="block flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs"
                      dir="ltr"
                    >
                      {publicUrl}
                    </code>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Copy link"
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl)
                        toast.success("Link copied")
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ---------------- live preview ---------------- */}
        {showPreview && (
        <div className="min-w-0">
          <div className="sticky top-14 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Eye className="size-4" />
                Live preview
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                <Button
                  size="icon-sm"
                  variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                  aria-label="Desktop preview"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                  aria-label="Mobile preview"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="size-3.5" />
                </Button>
                {/* the way out when a skin makes the preview unusable */}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Hide the preview"
                  title="Hide the preview"
                  onClick={() => setShowPreview(false)}
                >
                  <EyeOff className="size-3.5" />
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-border bg-background shadow-sm",
                previewDevice === "mobile" && "mx-auto w-[24rem] max-w-full rounded-[2rem] border-8 border-slate-800"
              )}
            >
              <div className="h-[calc(100svh-9rem)]">
                <PreviewFrame className="h-full w-full border-0">
                  <FormRenderer
                    form={previewForm}
                    fields={previewFieldRows}
                    answers={previewAnswers}
                    errors={{}}
                    onAnswer={(fieldId, value) =>
                      setPreviewAnswers((prev) => ({ ...prev, [fieldId]: value }))
                    }
                    onSubmit={(e) => e.preventDefault()}
                    preview
                  />
                </PreviewFrame>
              </div>
            </div>

            {!fields.some((f) => f.label.trim()) && (
              <p className="text-center text-xs text-muted-foreground">
                These are sample questions — add your own from the Questions tab.
              </p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
