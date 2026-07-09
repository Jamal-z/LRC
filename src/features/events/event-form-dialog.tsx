import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { useDepartments } from "@/features/departments/use-departments"
import { useAuth } from "@/features/auth/auth-context"
import { useSaveEvent, type EventListItem } from "./use-events"
import { EVENT_STATUS_LABELS } from "@/lib/constants"
import type { EventStatus } from "@/types/database.types"

const eventSchema = z.object({
  name: z.string().min(2, "Event name is required"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().optional(),
  short_description: z.string().optional(),
  status: z.string(),
  budget: z.string().optional(),
  department_ids: z.array(z.string()),
})

type EventForm = z.infer<typeof eventSchema>

export function EventFormDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: EventListItem | null
}) {
  const { profile } = useAuth()
  const { data: departments = [] } = useDepartments()
  const saveEvent = useSaveEvent()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      date: "",
      start_time: "",
      end_time: "",
      location: "",
      short_description: "",
      status: "draft",
      budget: "",
      department_ids: [],
    },
  })

  useEffect(() => {
    if (!open) return
    if (event) {
      reset({
        name: event.name,
        date: event.date,
        start_time: event.start_time?.slice(0, 5) ?? "",
        end_time: event.end_time?.slice(0, 5) ?? "",
        location: event.location ?? "",
        short_description: event.short_description ?? "",
        status: event.status,
        budget: event.budget != null ? String(event.budget) : "",
        department_ids: event.event_departments.map((ed) => ed.department_id),
      })
    } else {
      reset({
        name: "",
        date: "",
        start_time: "",
        end_time: "",
        location: "",
        short_description: "",
        status: "draft",
        budget: "",
        department_ids: [],
      })
    }
  }, [open, event, reset])

  async function onSubmit(values: EventForm) {
    try {
      await saveEvent.mutateAsync({
        event: {
          ...(event ? { id: event.id } : { created_by: profile?.id ?? null }),
          name: values.name,
          date: values.date,
          start_time: values.start_time || null,
          end_time: values.end_time || null,
          location: values.location || null,
          short_description: values.short_description || null,
          status: values.status as EventStatus,
          budget: values.budget ? Number(values.budget) : 0,
        },
        departmentIds: values.department_ids,
      })
      toast.success(event ? "Event updated" : "Event created")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "Create event"}</DialogTitle>
          <DialogDescription>
            {event ? "Update the event details." : "Plan a new center event."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="e-name">Event name *</FieldLabel>
            <Input id="e-name" {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="e-date">Date *</FieldLabel>
              <Input id="e-date" type="date" {...register("date")} />
              <FieldError errors={[errors.date]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-start">Start time</FieldLabel>
              <Input id="e-start" type="time" {...register("start_time")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="e-end">End time</FieldLabel>
              <Input id="e-end" type="time" {...register("end_time")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="e-location">Location</FieldLabel>
              <Input id="e-location" {...register("location")} />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "draft")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="e-budget">Budget</FieldLabel>
            <Input id="e-budget" type="number" step="0.01" min="0" {...register("budget")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="e-desc">Short description</FieldLabel>
            <Textarea id="e-desc" rows={2} {...register("short_description")} />
          </Field>

          <Field>
            <FieldLabel>Participating departments</FieldLabel>
            <Controller
              control={control}
              name="department_ids"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border p-3">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(dept.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, dept.id]
                              : field.value.filter((id) => id !== dept.id)
                          )
                        }
                      />
                      {dept.name}
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : event ? "Save changes" : "Create event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
