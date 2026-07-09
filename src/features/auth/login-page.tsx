import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { CalendarDays, ClipboardCheck, KanbanSquare, Users } from "lucide-react"
import { useAuth } from "./auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

const HIGHLIGHTS = [
  { icon: Users, title: "Volunteers", text: "Profiles, departments, skills and hours in one place" },
  { icon: CalendarDays, title: "Events & Booths", text: "Plan events with dynamic booths and leaders" },
  { icon: ClipboardCheck, title: "Evaluations", text: "Monthly and event-based volunteer evaluations" },
  { icon: KanbanSquare, title: "Tasks", text: "Trello-style boards for every department" },
]

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [formError, setFormError] = useState<string | null>(null)

  const [resetEmail, setResetEmail] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (session) {
    const from = (location.state as { from?: string })?.from ?? "/dashboard"
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: LoginForm) {
    setFormError(null)

    const { error } = await signIn(values.email, values.password)

    if (error) {
      if (/not confirmed/i.test(error)) {
        setFormError(
          "This account exists but its email was never confirmed. Ask the admin to disable \"Confirm email\" in Supabase (Authentication → Sign In / Providers → Email) and confirm existing users — then sign in again."
        )
      } else if (/invalid login credentials/i.test(error)) {
        setFormError("Incorrect email or password. Please try again.")
      } else {
        setFormError(error)
      }
      return
    }

    navigate("/dashboard", { replace: true })
  }

  async function handleSendResetEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setResetError(null)
    setResetSuccess(null)

    const email = resetEmail.trim()

    if (!email) {
      setResetError("Please enter your email address.")
      return
    }

    const emailCheck = z.string().email().safeParse(email)
    if (!emailCheck.success) {
      setResetError("Enter a valid email address.")
      return
    }

    setIsSendingReset(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSendingReset(false)

    if (error) {
      setResetError(error.message)
      return
    }

    setResetSuccess("Password reset link sent. Please check your email inbox and spam folder.")
  }

  function openForgotPassword() {
    setResetEmail(watch("email") ?? "")
    setResetError(null)
    setResetSuccess(null)
    setMode("forgot")
  }

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[oklch(0.22_0.06_265)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-[oklch(0.55_0.24_263)] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -right-44 size-[30rem] rounded-full bg-[oklch(0.62_0.21_260)] opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/4 size-[28rem] rounded-full bg-[oklch(0.71_0.17_255)] opacity-20 blur-3xl" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white shadow-lg ring-1 ring-white/20 backdrop-blur">
            LRC
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Language Resource Center</p>
            <p className="text-xs text-blue-200/80">Internal Platform</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            Volunteer
            <br />
            Management
            <br />
            <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-sky-200 bg-clip-text text-transparent">
              System
            </span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-blue-100/70">
            One elegant home for the center's volunteers, departments, events, evaluations and
            reports — built for the team that makes it all happen.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[0.1]"
              >
                <item.icon className="size-5 text-sky-300" />
                <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-blue-100/60">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-blue-200/50">
          © {new Date().getFullYear()} LRC — Language Resource Center · Internal use only
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50/60 px-6 py-12 dark:from-background dark:via-background dark:to-background">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-start gap-4 lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25">
              LRC
            </div>
          </div>

          {mode === "login" ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in with your internal staff account to continue.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
                <FieldGroup>
                  <Field data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@lrc.org"
                      className="h-11 rounded-xl"
                      {...register("email")}
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>

                  <Field data-invalid={!!errors.password}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl"
                      {...register("password")}
                    />
                    <FieldError errors={[errors.password]} />
                  </Field>

                  <div className="-mt-2 text-right">
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </button>
                  </div>

                  {formError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {formError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-2 h-11 w-full rounded-xl text-[0.9rem] shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </FieldGroup>
              </form>

              <p className="mt-8 text-center text-xs text-muted-foreground">
                Accounts are created by the center administration.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Reset password
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your account email. We will send you a password reset link.
              </p>

              <form onSubmit={handleSendResetEmail} noValidate className="mt-8">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="resetEmail">Email</FieldLabel>
                    <Input
                      id="resetEmail"
                      type="email"
                      autoComplete="email"
                      placeholder="name@lrc.org"
                      className="h-11 rounded-xl"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                    />
                  </Field>

                  {resetError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {resetError}
                    </p>
                  )}

                  {resetSuccess && (
                    <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                      {resetSuccess}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-2 h-11 w-full rounded-xl text-[0.9rem] shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? "Sending…" : "Send reset link"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11 w-full rounded-xl"
                    onClick={() => setMode("login")}
                  >
                    Back to login
                  </Button>
                </FieldGroup>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}