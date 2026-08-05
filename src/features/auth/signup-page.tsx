import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError, FieldGroup, FieldDescription } from "@/components/ui/field"

const signupSchema = z
  .object({
    full_name: z.string().min(3, "Please enter your full name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })

type SignupForm = z.infer<typeof signupSchema>

export function SignupPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) })

  if (session) return <Navigate to="/dashboard" replace />

  async function onSubmit(values: SignupForm) {
    setFormError(null)

    // New accounts always land on the lowest access level (booth leader).
    // A super admin promotes them afterwards from Users & Roles — the database
    // trigger refuses any admin role coming from the client.
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: { data: { full_name: values.full_name.trim(), role: "booth_leader" } },
    })

    if (error) {
      if (/rate limit/i.test(error.message)) {
        setFormError(
          "Too many sign-ups from this server right now. Please try again in a few minutes."
        )
      } else {
        setFormError(error.message)
      }
      return
    }

    // When "Confirm email" is on in Supabase there is no session yet.
    if (data.session) {
      navigate("/dashboard", { replace: true })
      return
    }
    setDone(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#071226] px-6 py-12">
      <div className="pointer-events-none fixed -top-40 -left-40 size-[30rem] rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-48 -right-40 size-[28rem] rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/20 backdrop-blur">
            LRC
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-sky-200/70">
            Language Resource Center
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0b1a35]/85 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl">
          {done ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="text-2xl font-semibold text-white">Account created</h2>
              <p className="text-sm text-blue-100/65">
                Check your inbox to confirm your email, then sign in. Your access level is set by
                the center administration.
              </p>
              <Button
                className="mt-2 h-11 w-full rounded-xl bg-sky-500 font-semibold text-white hover:bg-sky-400"
                render={<Link to="/login" />}
              >
                Go to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-3xl font-semibold tracking-tight text-white">Create account</h2>
                <p className="mt-2 text-sm text-blue-100/65">
                  Sign up to join the platform. An administrator will set your role and access.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <FieldGroup>
                  <Field data-invalid={!!errors.full_name}>
                    <FieldLabel htmlFor="su-name" className="text-blue-50/90">
                      Full name
                    </FieldLabel>
                    <Input
                      id="su-name"
                      className="h-11 rounded-xl border-white/10 bg-[#102341] text-white placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                      {...register("full_name")}
                    />
                    <FieldError errors={[errors.full_name]} />
                  </Field>

                  <Field data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="su-email" className="text-blue-50/90">
                      Email
                    </FieldLabel>
                    <Input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      className="h-11 rounded-xl border-white/10 bg-[#102341] text-white placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                      {...register("email")}
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>

                  <Field data-invalid={!!errors.password}>
                    <FieldLabel htmlFor="su-password" className="text-blue-50/90">
                      Password
                    </FieldLabel>
                    <Input
                      id="su-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-white/10 bg-[#102341] text-white placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                      {...register("password")}
                    />
                    <FieldDescription className="text-blue-100/45">
                      At least 8 characters.
                    </FieldDescription>
                    <FieldError errors={[errors.password]} />
                  </Field>

                  <Field data-invalid={!!errors.confirm_password}>
                    <FieldLabel htmlFor="su-confirm" className="text-blue-50/90">
                      Confirm password
                    </FieldLabel>
                    <Input
                      id="su-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-white/10 bg-[#102341] text-white placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                      {...register("confirm_password")}
                    />
                    <FieldError errors={[errors.confirm_password]} />
                  </Field>

                  {formError && (
                    <p className="rounded-xl border border-red-300/10 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {formError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="mt-2 h-11 w-full rounded-xl bg-sky-500 text-[0.9rem] font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-400"
                  >
                    {isSubmitting ? "Creating account…" : "Create account"}
                  </Button>
                </FieldGroup>
              </form>

              <p className="mt-7 text-center text-sm text-blue-100/55">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-sky-300 underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
