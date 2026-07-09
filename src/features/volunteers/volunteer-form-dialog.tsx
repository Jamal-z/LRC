import { useEffect, useRef, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useDepartments } from "@/features/departments/use-departments"
import { useSaveVolunteer, useTags, type VolunteerWithRelations } from "./use-volunteers"
import { VOLUNTEER_STATUS_LABELS } from "@/lib/constants"
import type { VolunteerStatus } from "@/types/database.types"

async function uploadAvatar(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `volunteers/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
}

const volunteerSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  university_id: z.string().optional(),
  major: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  city: z.string().optional(),
  birth_date: z.string().optional(),
  primary_department_id: z.string().min(1, "Primary department is required"),
  secondary_department_ids: z.array(z.string()),
  skills: z.string().optional(),
  languages: z.string().optional(),
  availability: z.string().optional(),
  status: z.string(),
  join_date: z.string().min(1, "Join date is required"),
  internal_notes: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  tag_ids: z.array(z.string()),
})

type VolunteerForm = z.infer<typeof volunteerSchema>

const EMPTY_VALUES: VolunteerForm = {
  full_name: "",
  university_id: "",
  major: "",
  phone: "",
  email: "",
  city: "",
  birth_date: "",
  primary_department_id: "",
  secondary_department_ids: [],
  skills: "",
  languages: "",
  availability: "",
  status: "new",
  join_date: new Date().toISOString().slice(0, 10),
  internal_notes: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  tag_ids: [],
}

export function VolunteerFormDialog({
  open,
  onOpenChange,
  volunteer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  volunteer?: VolunteerWithRelations | null
}) {
  const { data: departments = [] } = useDepartments()
  const { data: tags = [] } = useTags()
  const saveVolunteer = useSaveVolunteer()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VolunteerForm>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (!open) return
    if (volunteer) {
      reset({
        full_name: volunteer.full_name,
        university_id: volunteer.university_id ?? "",
        major: volunteer.major ?? "",
        phone: volunteer.phone ?? "",
        email: volunteer.email ?? "",
        city: volunteer.city ?? "",
        birth_date: volunteer.birth_date ?? "",
        primary_department_id: volunteer.primary_department_id ?? "",
        secondary_department_ids: volunteer.volunteer_departments
          .filter((vd) => !vd.is_primary)
          .map((vd) => vd.department_id),
        skills: volunteer.skills ?? "",
        languages: volunteer.languages ?? "",
        availability: volunteer.availability ?? "",
        status: volunteer.status,
        join_date: volunteer.join_date,
        internal_notes: volunteer.internal_notes ?? "",
        emergency_contact_name: volunteer.emergency_contact_name ?? "",
        emergency_contact_phone: volunteer.emergency_contact_phone ?? "",
        tag_ids: volunteer.volunteer_tags.map((vt) => vt.tag_id),
      })
    } else {
      reset(EMPTY_VALUES)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
  }, [open, volunteer, reset])

  async function onSubmit(values: VolunteerForm) {
    try {
      let photoUrl = volunteer?.photo_url ?? null
      if (photoFile) {
        photoUrl = await uploadAvatar(photoFile)
      }
      await saveVolunteer.mutateAsync({
        volunteer: {
          ...(volunteer ? { id: volunteer.id } : {}),
          full_name: values.full_name,
          university_id: values.university_id || null,
          major: values.major || null,
          phone: values.phone || null,
          email: values.email || null,
          city: values.city || null,
          birth_date: values.birth_date || null,
          primary_department_id: values.primary_department_id,
          skills: values.skills || null,
          languages: values.languages || null,
          availability: values.availability || null,
          status: values.status as VolunteerStatus,
          join_date: values.join_date,
          internal_notes: values.internal_notes || null,
          emergency_contact_name: values.emergency_contact_name || null,
          emergency_contact_phone: values.emergency_contact_phone || null,
          photo_url: photoUrl,
        },
        secondaryDepartmentIds: values.secondary_department_ids,
        tagIds: values.tag_ids,
      })
      toast.success(volunteer ? "Volunteer updated" : "Volunteer added")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{volunteer ? "Edit volunteer" : "Add volunteer"}</DialogTitle>
          <DialogDescription>
            {volunteer
              ? "Update this volunteer's information."
              : "Add a new volunteer to the system."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="group relative"
              onClick={() => photoInputRef.current?.click()}
              aria-label="Upload photo"
            >
              <Avatar className="size-16">
                {(photoPreview || volunteer?.photo_url) && (
                  <AvatarImage src={photoPreview ?? volunteer?.photo_url ?? undefined} />
                )}
                <AvatarFallback className="bg-accent text-accent-foreground">
                  <Camera className="size-5" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform group-hover:scale-110">
                <Camera className="size-3" />
              </span>
            </button>
            <div>
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <p className="text-xs text-muted-foreground">
                Click to upload a photo (JPG/PNG). Optional.
              </p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setPhotoFile(file)
                  setPhotoPreview(URL.createObjectURL(file))
                }
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" data-invalid={!!errors.full_name}>
              <FieldLabel htmlFor="v-full-name">Full name *</FieldLabel>
              <Input id="v-full-name" {...register("full_name")} />
              <FieldError errors={[errors.full_name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-university-id">University ID</FieldLabel>
              <Input id="v-university-id" {...register("university_id")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-major">Major</FieldLabel>
              <Input id="v-major" {...register("major")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-phone">WhatsApp number</FieldLabel>
              <Input id="v-phone" dir="ltr" {...register("phone")} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="v-email">Email</FieldLabel>
              <Input id="v-email" type="email" {...register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-city">City</FieldLabel>
              <Input id="v-city" {...register("city")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-birth-date">Birth date</FieldLabel>
              <Input id="v-birth-date" type="date" {...register("birth_date")} />
            </Field>

            <Field data-invalid={!!errors.primary_department_id}>
              <FieldLabel>Primary department *</FieldLabel>
              <Controller
                control={control}
                name="primary_department_id"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.primary_department_id]} />
            </Field>

            <Field>
              <FieldLabel>Status</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "new")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VOLUNTEER_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!errors.join_date}>
              <FieldLabel htmlFor="v-join-date">Join date *</FieldLabel>
              <Input id="v-join-date" type="date" {...register("join_date")} />
              <FieldError errors={[errors.join_date]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-availability">Availability</FieldLabel>
              <Input id="v-availability" placeholder="e.g. Weekends, evenings" {...register("availability")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-skills">Skills</FieldLabel>
              <Input id="v-skills" placeholder="e.g. Design, teaching" {...register("skills")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="v-languages">Languages</FieldLabel>
              <Input id="v-languages" placeholder="e.g. Arabic, English" {...register("languages")} />
            </Field>
          </div>

          <Field>
            <FieldLabel>Secondary departments</FieldLabel>
            <Controller
              control={control}
              name="secondary_department_ids"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border p-3">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked
                              ? [...field.value, dept.id]
                              : field.value.filter((id) => id !== dept.id)
                          )
                        }}
                      />
                      {dept.name}
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field>
            <FieldLabel>Tags</FieldLabel>
            <Controller
              control={control}
              name="tag_ids"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = field.value.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          field.onChange(
                            selected
                              ? field.value.filter((id) => id !== tag.id)
                              : [...field.value, tag.id]
                          )
                        }
                      >
                        <Badge
                          variant={selected ? "default" : "outline"}
                          className="cursor-pointer"
                          style={selected ? { backgroundColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="v-ec-name">Emergency contact name</FieldLabel>
              <Input id="v-ec-name" {...register("emergency_contact_name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="v-ec-phone">Emergency contact phone</FieldLabel>
              <Input id="v-ec-phone" {...register("emergency_contact_phone")} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="v-notes">Internal notes</FieldLabel>
            <Textarea id="v-notes" rows={3} {...register("internal_notes")} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : volunteer ? "Save changes" : "Add volunteer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
