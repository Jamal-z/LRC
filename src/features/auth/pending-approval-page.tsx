import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LrcLogoPlate } from "@/components/shared/lrc-logo"
import { useAuth } from "./auth-context"

/**
 * Shown to someone whose account exists but hasn't been approved yet.
 * Approval happens in Users & Roles — there is no confirmation email.
 */
export function PendingApprovalPage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#071226] px-6 py-12">
      <div className="pointer-events-none fixed -top-40 -left-40 size-[30rem] rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-48 -right-40 size-[28rem] rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <LrcLogoPlate className="rounded-2xl px-3 py-2 shadow-lg" logoClassName="h-9" />
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0b1a35]/85 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/25">
            <Clock className="size-7" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Waiting for approval
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100/70">
            Your account{profile ? ` (${profile.email})` : ""} was created and the committee has
            been notified. Once someone approves it from Users &amp; Roles, sign in again and
            you're in.
          </p>

          <Button variant="outline" className="mt-7 w-full" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
