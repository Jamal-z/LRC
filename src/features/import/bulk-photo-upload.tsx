import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ImagePlus, UserRoundSearch } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"

interface VolunteerRef {
  id: string
  full_name: string
}

interface UnresolvedPhoto {
  file: File
  fileName: string
  reason: "ambiguous" | "unmatched"
  suggestions: VolunteerRef[]
  selectedVolunteerId: string | null
  uploading?: boolean
}

// Match a photo's file name to a volunteer, most reliable tier first:
//  1. exact full name        "عمرو عنبتاوي علي حسن"
//  2. name prefix (binary)   "عمرو عنبتاوي" -> "عمرو عنبتاوي علي حسن"
//  3. words in order         "عمرو عنبتاوي" ~ "عمرو محمد عنبتاوي"
//  4. family name (last word) unique across volunteers
//  5. first name unique across volunteers
// Mixed English/Arabic names split by dashes are tried segment by segment.
// Auto-assign only on a UNIQUE match; otherwise the photo is queued for
// manual assignment with the closest candidates suggested.
function matchVolunteer(
  baseName: string,
  volunteers: VolunteerRef[]
): { volunteer: VolunteerRef | null; suggestions: VolunteerRef[] } {
  const candidates = [baseName, ...baseName.split(/[-–_]+/)]
    .map((c) => c.trim())
    .filter(Boolean)

  const allSuggestions = new Map<string, VolunteerRef>()

  for (const candidate of candidates) {
    const key = normalizeName(candidate)
    if (!key) continue
    const words = key.split(" ")

    const tiers: VolunteerRef[][] = [
      volunteers.filter((v) => normalizeName(v.full_name) === key),
      volunteers.filter((v) => normalizeName(v.full_name).startsWith(key + " ")),
      words.length >= 2
        ? volunteers.filter((v) => {
            const nameWords = normalizeName(v.full_name).split(" ")
            let matched = 0
            for (const word of nameWords) {
              if (matched < words.length && word === words[matched]) matched++
            }
            return matched === words.length
          })
        : [],
      // family name (last word of the photo name matches last word of volunteer name)
      volunteers.filter((v) => {
        const nameWords = normalizeName(v.full_name).split(" ")
        return nameWords[nameWords.length - 1] === words[words.length - 1]
      }),
      // first name
      volunteers.filter((v) => normalizeName(v.full_name).split(" ")[0] === words[0]),
    ]

    for (const tier of tiers) {
      if (tier.length === 1) return { volunteer: tier[0], suggestions: [] }
      for (const v of tier) allSuggestions.set(v.id, v)
    }
  }

  return { volunteer: null, suggestions: Array.from(allSuggestions.values()).slice(0, 6) }
}

async function uploadPhotoFor(file: File, volunteer: VolunteerRef) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `volunteers/${volunteer.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
  // cache-bust so a replaced photo shows immediately
  const { error: updateError } = await supabase
    .from("volunteers")
    .update({ photo_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", volunteer.id)
  if (updateError) throw updateError
}

export function BulkPhotoUpload() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [assignedCount, setAssignedCount] = useState(0)
  const [unresolved, setUnresolved] = useState<UnresolvedPhoto[]>([])
  const [volunteers, setVolunteers] = useState<VolunteerRef[]>([])

  async function handleFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (!imageFiles.length) {
      toast.error("No image files found. Upload JPG/PNG photos named after each volunteer.")
      return
    }

    setUploading(true)
    setProgress(0)

    const { data: volunteerRows, error } = await supabase
      .from("volunteers")
      .select("id, full_name")
      .neq("status", "archived")
    if (error) {
      toast.error("Couldn't load volunteers: " + error.message)
      setUploading(false)
      return
    }
    setVolunteers(volunteerRows)

    let assigned = 0
    const pending: UnresolvedPhoto[] = []

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const baseName = file.name.replace(/\.[^.]+$/, "")
      const { volunteer, suggestions } = matchVolunteer(baseName, volunteerRows)

      if (volunteer) {
        try {
          await uploadPhotoFor(file, volunteer)
          assigned++
        } catch {
          pending.push({
            file,
            fileName: file.name,
            reason: "unmatched",
            suggestions,
            selectedVolunteerId: null,
          })
        }
      } else {
        pending.push({
          file,
          fileName: file.name,
          reason: suggestions.length ? "ambiguous" : "unmatched",
          suggestions,
          selectedVolunteerId: suggestions.length === 1 ? suggestions[0].id : null,
        })
      }
      setProgress(Math.round(((i + 1) / imageFiles.length) * 100))
    }

    queryClient.invalidateQueries({ queryKey: ["volunteers"] })
    setAssignedCount((count) => count + assigned)
    setUnresolved((prev) => [...prev, ...pending])
    setUploading(false)

    if (assigned > 0) toast.success(`${assigned} photo${assigned === 1 ? "" : "s"} assigned automatically`)
    if (pending.length > 0)
      toast.info(`${pending.length} photo${pending.length === 1 ? "" : "s"} need your confirmation below`)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function assignManually(index: number) {
    const item = unresolved[index]
    if (!item?.selectedVolunteerId) return
    const volunteer = volunteers.find((v) => v.id === item.selectedVolunteerId)
    if (!volunteer) return

    setUnresolved((prev) => prev.map((p, i) => (i === index ? { ...p, uploading: true } : p)))
    try {
      await uploadPhotoFor(item.file, volunteer)
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      setUnresolved((prev) => prev.filter((_, i) => i !== index))
      setAssignedCount((count) => count + 1)
      toast.success(`Photo assigned to ${volunteer.full_name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
      setUnresolved((prev) => prev.map((p, i) => (i === index ? { ...p, uploading: false } : p)))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImagePlus className="size-4" />
          Bulk photo upload
        </CardTitle>
        <CardDescription>
          Name each photo with the volunteer's name — full, partial, family name, Arabic or English
          (e.g. <span dir="rtl" className="font-medium">عمرو عنبتاوي.jpg</span> or{" "}
          <span className="font-medium">Amr Anabtawi-عمرو عنبتاوي.jpeg</span>). Photos I can match
          confidently are assigned automatically; anything unclear is listed below and I'll ask you
          to pick the right volunteer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-10 transition-colors hover:border-primary/50 hover:bg-accent/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (!uploading) handleFiles(e.dataTransfer.files)
          }}
        >
          <ImagePlus className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Matching & uploading…" : "Click or drag photos here (multiple allowed)"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>

        {uploading && <Progress value={progress} />}

        {assignedCount > 0 && unresolved.length === 0 && !uploading && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" />
            {assignedCount} photo{assignedCount === 1 ? "" : "s"} assigned — all matched!
          </p>
        )}

        {unresolved.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <UserRoundSearch className="size-4 text-amber-500" />
              These photos need you to pick the volunteer ({unresolved.length}):
            </p>
            {unresolved.map((item, index) => (
              <div
                key={item.fileName + index}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <span className="min-w-40 flex-1 truncate text-sm" title={item.fileName}>
                  {item.fileName}
                </span>
                {item.reason === "ambiguous" && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    Multiple possible matches
                  </Badge>
                )}
                <Select
                  value={item.selectedVolunteerId}
                  onValueChange={(v) =>
                    setUnresolved((prev) =>
                      prev.map((p, i) => (i === index ? { ...p, selectedVolunteerId: v } : p))
                    )
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Choose volunteer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(item.suggestions.length ? item.suggestions : volunteers).map((volunteer) => (
                      <SelectItem key={volunteer.id} value={volunteer.id}>
                        {volunteer.full_name}
                      </SelectItem>
                    ))}
                    {item.suggestions.length > 0 &&
                      volunteers
                        .filter((v) => !item.suggestions.some((s) => s.id === v.id))
                        .map((volunteer) => (
                          <SelectItem key={volunteer.id} value={volunteer.id}>
                            {volunteer.full_name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!item.selectedVolunteerId || item.uploading}
                  onClick={() => assignManually(index)}
                >
                  {item.uploading ? "Uploading…" : "Assign"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUnresolved((prev) => prev.filter((_, i) => i !== index))}
                >
                  Skip
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
