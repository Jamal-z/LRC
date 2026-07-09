import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2, HeartHandshake } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useDepartments } from "@/features/departments/use-departments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

const joinSchema = z.object({
  full_name: z.string().min(4, "الاسم الرباعي مطلوب / Full name is required"),
  university_id: z.string().min(1, "الرقم الجامعي مطلوب / University ID is required"),
  major: z.string().min(1, "التخصص مطلوب / Major is required"),
  phone: z.string().min(8, "رقم واتساب صحيح مطلوب / Valid WhatsApp number required"),
  email: z.string().email("بريد غير صالح / Invalid email").optional().or(z.literal("")),
  city: z.string().min(1, "مكان السكن مطلوب / Residence is required"),
  department_id: z.string().min(1, "اختر الفريق / Choose a team"),
  languages: z.string().optional(),
  skills: z.string().optional(),
  availability: z.string().optional(),
  notes: z.string().optional(),
})

type JoinForm = z.infer<typeof joinSchema>

export function JoinPage() {
  const { data: departments = [] } = useDepartments()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JoinForm>({ resolver: zodResolver(joinSchema) })

  async function onSubmit(values: JoinForm) {
    setSubmitError(null)
    const { error } = await supabase.from("form_submissions").insert({
      full_name: values.full_name.trim(),
      university_id: values.university_id || null,
      major: values.major || null,
      phone: values.phone || null,
      email: values.email || null,
      city: values.city || null,
      department_id: values.department_id,
      languages: values.languages || null,
      skills: values.skills || null,
      availability: values.availability || null,
      notes: values.notes || null,
    })
    if (error) {
      setSubmitError("حدث خطأ، حاول مرة أخرى / Something went wrong, please try again.")
      return
    }
    setSubmitted(true)
  }

  return (
    <div className="min-h-svh bg-[oklch(0.22_0.06_265)] px-4 py-10">
      {/* decorative blobs */}
      <div className="pointer-events-none fixed -top-40 -left-40 size-[30rem] rounded-full bg-[oklch(0.55_0.24_263)] opacity-25 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-48 -right-40 size-[28rem] rounded-full bg-[oklch(0.71_0.17_255)] opacity-20 blur-3xl" />

      <div className="relative mx-auto max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/20 backdrop-blur">
            LRC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            انضم لعائلة المتطوعين
          </h1>
          <p className="max-w-md text-sm text-blue-100/70">
            Language Resource Center — Volunteer Registration
          </p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center shadow-2xl dark:bg-card">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">تم استلام طلبك! 🎉</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              شكرًا لتسجيلك معنا. فريق المركز رح يراجع طلبك ويتواصل معك قريبًا عبر الواتساب.
            </p>
            <p className="text-xs text-muted-foreground">
              Thank you! Your application was received — we'll contact you soon.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8 dark:bg-card"
            dir="rtl"
          >
            <Field data-invalid={!!errors.full_name}>
              <FieldLabel htmlFor="j-name">الاسم الرباعي *</FieldLabel>
              <Input id="j-name" className="h-11 rounded-xl" {...register("full_name")} />
              <FieldError errors={[errors.full_name]} />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.university_id}>
                <FieldLabel htmlFor="j-uni">الرقم الجامعي *</FieldLabel>
                <Input id="j-uni" dir="ltr" className="h-11 rounded-xl" {...register("university_id")} />
                <FieldError errors={[errors.university_id]} />
              </Field>
              <Field data-invalid={!!errors.major}>
                <FieldLabel htmlFor="j-major">التخصص *</FieldLabel>
                <Input id="j-major" className="h-11 rounded-xl" {...register("major")} />
                <FieldError errors={[errors.major]} />
              </Field>
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="j-phone">رقم الواتساب *</FieldLabel>
                <Input id="j-phone" dir="ltr" className="h-11 rounded-xl" {...register("phone")} />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.city}>
                <FieldLabel htmlFor="j-city">مكان السكن *</FieldLabel>
                <Input id="j-city" className="h-11 rounded-xl" {...register("city")} />
                <FieldError errors={[errors.city]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="j-email">البريد الإلكتروني (اختياري)</FieldLabel>
              <Input id="j-email" type="email" dir="ltr" className="h-11 rounded-xl" {...register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={!!errors.department_id}>
              <FieldLabel>الفريق الذي ترغب بالتطوع فيه *</FieldLabel>
              <Controller
                control={control}
                name="department_id"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue placeholder="اختر الفريق" />
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
              <FieldError errors={[errors.department_id]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="j-languages">اللغات التي تتقنها ومستواها</FieldLabel>
              <Input
                id="j-languages"
                placeholder="مثال: انجليزي: ممتاز، تركي: مبتدئ"
                className="h-11 rounded-xl"
                {...register("languages")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="j-skills">مهاراتك</FieldLabel>
                <Input id="j-skills" placeholder="تصميم، تصوير، تنظيم…" className="h-11 rounded-xl" {...register("skills")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="j-availability">أوقات تفرغك</FieldLabel>
                <Input id="j-availability" placeholder="نهاية الأسبوع، مساءً…" className="h-11 rounded-xl" {...register("availability")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="j-notes">ملاحظات إضافية</FieldLabel>
              <Textarea id="j-notes" rows={3} className="rounded-xl" {...register("notes")} />
            </Field>

            {submitError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 rounded-xl text-base shadow-lg shadow-primary/25"
            >
              <HeartHandshake className="size-5" />
              {isSubmitting ? "جارٍ الإرسال…" : "سجّل الآن"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-blue-200/50">
          Designed by Jamal Ilaiwi · LRC {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
