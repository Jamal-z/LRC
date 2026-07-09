import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && profile) {
      setFullName(profile.full_name)
      setNewPassword("")
      setPhotoFile(null)
      setPhotoPreview(null)
    }
  }, [open, profile])

  async function handleSave() {
    if (!profile) return
    if (fullName.trim().length < 2) {
      toast.error("Name is too short")
      return
    }
    if (newPassword && newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }

    setSaving(true)
    try {
      let avatarUrl = profile.avatar_url
      if (photoFile) {
        const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `staff/${profile.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true })
        if (uploadError) throw uploadError
        avatarUrl =
          supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), avatar_url: avatarUrl })
        .eq("id", profile.id)
      if (profileError) throw profileError

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
        if (passwordError) throw passwordError
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("Account updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update account")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My account</DialogTitle>
          <DialogDescription>Update your photo, name, or password.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="group relative"
              onClick={() => photoInputRef.current?.click()}
              aria-label="Change photo"
            >
              <Avatar className="size-16">
                {(photoPreview || profile?.avatar_url) && (
                  <AvatarImage src={photoPreview ?? profile?.avatar_url ?? undefined} />
                )}
                <AvatarFallback className="bg-accent text-accent-foreground">
                  {profile ? initials(profile.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform group-hover:scale-110">
                <Camera className="size-3" />
              </span>
            </button>
            <div>
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <p className="text-xs text-muted-foreground">Click the avatar to upload a new one.</p>
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

          <Field>
            <FieldLabel htmlFor="acc-name">Full name</FieldLabel>
            <Input id="acc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="acc-email">Email</FieldLabel>
            <Input id="acc-email" value={profile?.email ?? ""} disabled />
          </Field>

          <Field>
            <FieldLabel htmlFor="acc-password">New password</FieldLabel>
            <Input
              id="acc-password"
              type="password"
              placeholder="Leave empty to keep current password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
