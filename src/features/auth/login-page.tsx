import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { ImageIcon } from "lucide-react"
import { useAuth } from "./auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"
import { PasswordInput } from "@/components/shared/password-input"
import { LrcLogoPlate } from "@/components/shared/lrc-logo"
import { useLoginPagePhotos } from "@/features/settings/use-login-page-photos"

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: loginPhotos = [] } = useLoginPagePhotos()

  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
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

  useEffect(() => {
    if (loginPhotos.length < 2) return undefined

    const interval = window.setInterval(() => {
      setActivePhotoIndex((current) => (current + 1) % loginPhotos.length)
    }, 4500)

    return () => window.clearInterval(interval)
  }, [loginPhotos.length])

  useEffect(() => {
    if (activePhotoIndex >= loginPhotos.length) {
      setActivePhotoIndex(0)
    }
  }, [activePhotoIndex, loginPhotos.length])

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
          'This account exists but its email was never confirmed. Ask the admin to disable "Confirm email" in Supabase and confirm existing users, then sign in again.'
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

  const hasPhotos = loginPhotos.length > 0

  return (
    <div className="grid min-h-svh grid-cols-1 bg-[#071226] lg:grid-cols-[1.08fr_0.92fr]">
      {/* Left photo panel */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        {hasPhotos ? (
          loginPhotos.map((photo, index) => (
            <img
              key={`${photo.path}-${photo.created_at}`}
              src={photo.url}
              alt={photo.alt || "LRC group photo"}
              style={{
                objectPosition: `${photo.positionX ?? 50}% ${photo.positionY ?? 50}%`,
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-in-out ${
                index === activePhotoIndex ? "scale-100 opacity-100" : "scale-105 opacity-0"
              }`}
            />
          ))
        ) : (
          <div className="flex h-full items-center justify-center bg-[#071226] p-12 text-white">
            <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ImageIcon className="size-7 text-sky-200" />
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">LRC moments</h1>
              <p className="mt-3 text-sm leading-relaxed text-blue-100/70">
                Add group photos from Settings → Login page photos to turn this area into a live
                photo slideshow.
              </p>
            </div>
          </div>
        )}

        {/* dark cinematic overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020817]/90 via-[#071226]/35 to-[#071226]/65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_82%_75%,rgba(30,64,175,0.22),transparent_38%)]" />

        {/* main title */}
        <div className="absolute top-9 left-10 z-10">
          <div className="mb-4 flex items-center gap-3">
            <LrcLogoPlate className="rounded-2xl px-3 py-2 shadow-lg" logoClassName="h-8" />
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-sky-100/80">
              Internal Platform
            </p>
          </div>

          <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-white drop-shadow-2xl xl:text-5xl 2xl:text-6xl">
            Language Resource Center
          </h1>

          <div className="mt-5 h-px w-72 bg-gradient-to-r from-sky-300/80 via-white/35 to-transparent" />
        </div>

        {/* bottom-left credit */}
        <div className="absolute bottom-8 left-10 z-10">
          <p className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-medium tracking-wide text-white/90 shadow-lg shadow-black/20 backdrop-blur-md">
            Designed by Jamal
          </p>
        </div>

        {/* slideshow indicators */}
        {loginPhotos.length > 1 && (
          <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-md">
            {loginPhotos.map((photo, index) => (
              <button
                key={photo.path}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  index === activePhotoIndex ? "w-8 bg-white" : "w-2 bg-white/45 hover:bg-white/75"
                }`}
                onClick={() => setActivePhotoIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right form panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-[#071226] px-6 py-12">
        {/* soft abstract background, no grid */}
        <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-blue-500/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 -left-36 size-[30rem] rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 size-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),transparent_35%,rgba(56,189,248,0.05))]" />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex flex-col items-start gap-4 lg:hidden">
            <LrcLogoPlate className="rounded-2xl px-3 py-2 shadow-lg" logoClassName="h-8" />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0b1a35]/85 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl">
            {mode === "login" ? (
              <>
                <div className="mb-7">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-sky-200/70">
                    LRC Access
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">
                    Welcome back
                  </h2>
                  <p className="mt-2 text-sm text-blue-100/65">
                    Sign in with your internal staff account to continue.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <FieldGroup>
                    <Field data-invalid={!!errors.email}>
                      <FieldLabel htmlFor="email" className="text-blue-50/90">
                        Email
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@lrc.org"
                        className="h-11 rounded-xl border-white/10 bg-[#102341] text-white shadow-inner shadow-black/10 placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                        {...register("email")}
                      />
                      <FieldError errors={[errors.email]} />
                    </Field>

                    <Field data-invalid={!!errors.password}>
                      <FieldLabel htmlFor="password" className="text-blue-50/90">
                        Password
                      </FieldLabel>
                      <PasswordInput
                        id="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl border-white/10 bg-[#102341] text-white shadow-inner shadow-black/10 placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                        {...register("password")}
                      />
                      <FieldError errors={[errors.password]} />
                    </Field>

                    <div className="-mt-2 text-right">
                      <button
                        type="button"
                        onClick={openForgotPassword}
                        className="text-xs font-medium text-sky-300 underline-offset-4 transition-colors hover:text-sky-200 hover:underline"
                      >
                        Forgot your password?
                      </button>
                    </div>

                    {formError && (
                      <p className="rounded-xl border border-red-300/10 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {formError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      className="mt-2 h-11 w-full rounded-xl bg-sky-500 text-[0.9rem] font-semibold text-white shadow-lg shadow-sky-950/40 transition-all hover:bg-sky-400"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Signing in…" : "Sign in"}
                    </Button>
                  </FieldGroup>
                </form>

                <p className="mt-7 text-center text-sm text-blue-100/55">
                  Don't have an account?{" "}
                  <Link
                    to="/signup"
                    className="font-medium text-sky-300 underline-offset-4 hover:underline"
                  >
                    Create one
                  </Link>
                </p>
                <p className="mt-2 text-center text-xs text-blue-100/40">
                  New accounts start with the lowest access level until an admin assigns your role.
                </p>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-sky-200/70">
                    Account Recovery
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">
                    Reset password
                  </h2>
                  <p className="mt-2 text-sm text-blue-100/65">
                    Enter your account email. We will send you a password reset link.
                  </p>
                </div>

                <form onSubmit={handleSendResetEmail} noValidate>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="resetEmail" className="text-blue-50/90">
                        Email
                      </FieldLabel>
                      <Input
                        id="resetEmail"
                        type="email"
                        autoComplete="email"
                        placeholder="name@lrc.org"
                        className="h-11 rounded-xl border-white/10 bg-[#102341] text-white shadow-inner shadow-black/10 placeholder:text-blue-100/35 focus-visible:ring-sky-300/40"
                        value={resetEmail}
                        onChange={(event) => setResetEmail(event.target.value)}
                      />
                    </Field>

                    {resetError && (
                      <p className="rounded-xl border border-red-300/10 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {resetError}
                      </p>
                    )}

                    {resetSuccess && (
                      <p className="rounded-xl border border-emerald-300/10 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                        {resetSuccess}
                      </p>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      className="mt-2 h-11 w-full rounded-xl bg-sky-500 text-[0.9rem] font-semibold text-white shadow-lg shadow-sky-950/40 transition-all hover:bg-sky-400"
                      disabled={isSendingReset}
                    >
                      {isSendingReset ? "Sending…" : "Send reset link"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-11 w-full rounded-xl text-blue-100/75 hover:bg-white/8 hover:text-white"
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
    </div>
  )
}