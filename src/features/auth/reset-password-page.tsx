import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

function readUrlError() {
  const hash = window.location.hash.replace(/^#/, "")
  const params = new URLSearchParams(hash)

  const description = params.get("error_description")
  const error = params.get("error")

  if (description) {
    return description.replaceAll("+", " ")
  }

  if (error) {
    return error.replaceAll("+", " ")
  }

  return null
}

export function ResetPasswordPage() {
  const navigate = useNavigate()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    const urlError = readUrlError()

    if (urlError) {
      setPageError(urlError)
      setIsCheckingSession(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session)
      setIsCheckingSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true)
        setPageError(null)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)

    if (!hasRecoverySession) {
      setError("This reset link is invalid or expired. Please request a new password reset link.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setIsSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    await supabase.auth.signOut()
  }

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6 dark:from-background dark:via-background dark:to-background">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been changed successfully. You can now sign in with the new password.
          </p>

          <Button
            className="mt-6 w-full"
            onClick={() => navigate("/login", { replace: true })}
          >
            Back to login
          </Button>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6 dark:from-background dark:via-background dark:to-background">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Reset link problem</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This password reset link is invalid or expired. Please go back to login and request a new link.
          </p>

          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {pageError}
          </p>

          <Button
            className="mt-6 w-full"
            onClick={() => navigate("/login", { replace: true })}
          >
            Back to login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6 dark:from-background dark:via-background dark:to-background">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your new password below.
        </p>

        {isCheckingSession && (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Checking reset link…
          </p>
        )}

        {!isCheckingSession && !hasRecoverySession && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This page must be opened from the latest password reset email link.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl"
              />
            </Field>

            {error && (
              <Field>
                <FieldError>{error}</FieldError>
              </Field>
            )}

            <Button
              type="submit"
              className="mt-2 h-11 w-full rounded-xl"
              disabled={isSubmitting || isCheckingSession}
            >
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}