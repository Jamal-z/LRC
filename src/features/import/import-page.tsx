import { useMemo, useRef, useState } from "react"
import Papa from "papaparse"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartments } from "@/features/departments/use-departments"
import { useQueryClient } from "@tanstack/react-query"
import { BulkPhotoUpload } from "./bulk-photo-upload"
import type { VolunteerStatus } from "@/types/database.types"

// ---------- field mapping ----------

const SYSTEM_FIELDS = [
  { key: "full_name", label: "Full Name", required: true },
  { key: "university_id", label: "University ID (student number)", required: false },
  { key: "major", label: "Major", required: false },
  { key: "phone", label: "WhatsApp Number", required: false },
  { key: "email", label: "Email", required: false },
  { key: "city", label: "City / Residence", required: false },
  { key: "department", label: "Team / Department", required: false },
  { key: "skills", label: "Skills", required: false },
  { key: "languages", label: "Languages", required: false },
  { key: "availability", label: "Availability", required: false },
  { key: "status", label: "Status", required: false },
  { key: "internal_notes", label: "Notes", required: false },
] as const

type SystemFieldKey = (typeof SYSTEM_FIELDS)[number]["key"]

const SKIP = "__skip__"

// auto-guess mapping from common header names (English + Arabic).
// Order matters: more specific fields are checked before generic ones
// (e.g. "رقم الطالب" must hit university_id before phone's generic "رقم").
const HEADER_GUESSES: Record<SystemFieldKey, string[]> = {
  full_name: ["name", "full name", "fullname", "volunteer", "الاسم", "الاسم الكامل", "اسم المتطوع"],
  university_id: [
    "university id", "student id", "student number",
    "رقم الطالب", "الرقم الجامعي", "رقم جامعي", "رقمك الجامعي", "الرقم الجامعى",
  ],
  major: ["major", "specialization", "التخصص", "تخصصك", "تخصص"],
  department: [
    "department", "team", "القسم", "الفريق",
    "المجال الذي ترغب", "المجال", "مجال التطوع", "ترغب التطوع", "التطوع فيه",
  ],
  phone: ["whatsapp", "phone", "mobile", "واتساب", "الواتس", "واتس", "الهاتف", "الجوال", "موبايل", "رقم"],
  email: ["email", "e-mail", "mail", "الايميل", "البريد"],
  city: ["city", "location", "residence", "المدينة", "السكن", "مكان السكن", "مكان"],
  skills: ["skill", "skills", "مهارات", "المهارات"],
  languages: ["language", "languages", "لغات", "اللغات", "اللغة"],
  availability: ["availability", "available", "توفر", "التفرغ", "اوقات"],
  status: ["status", "الحالة", "الوضع"],
  internal_notes: ["note", "notes", "comment", "ملاحظات", "ملاحظة"],
}

// Maps free-text team answers from the sheet (e.g. the long
// "التطوع الميداني : زيارات تعريفية داخل المدينة…" descriptions)
// to the center's six departments via keywords, most specific first.
const DEPARTMENT_VALUE_KEYWORDS: { keywords: string[]; department: string }[] = [
  { keywords: ["ميداني", "زيارات", "field"], department: "Field Volunteering" },
  { keywords: ["جرافيك", "تصميم", "غرافيك", "design"], department: "Graphic Design Team" },
  {
    keywords: ["سوشال", "محتوى", "تصوير", "مونتاج", "فيديو", "منصات", "social", "content"],
    department: "Social Media Team",
  },
  {
    keywords: ["تعليم اللغة العربية", "تعليم العربية", "لغة عربية", "العامية", "الفصحى", "teaching", "arabic"],
    department: "Arabic Teaching for Foreigners Team",
  },
  { keywords: ["ترجمة", "تحرير", "أخبار", "اخبار", "translation", "editing"], department: "Translation and News Editing Team" },
  {
    keywords: ["تمويل", "علاقات", "رعاة", "دعم", "funding", "relations", "pr"],
    department: "Funding and Public Relations Team",
  },
]

function guessDepartmentFromValue(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  for (const entry of DEPARTMENT_VALUE_KEYWORDS) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) return entry.department
  }
  return null
}

// "languages" may be mapped from MANY sheet columns (one column per language,
// e.g. "اللغات التي تتقنها ومستواها [انجليزي]") — they get merged into one
// profile field. Every other system field maps from a single column.
const MULTI_COLUMN_FIELDS: SystemFieldKey[] = ["languages"]

function guessMapping(headers: string[]): Record<string, SystemFieldKey | typeof SKIP> {
  const mapping: Record<string, SystemFieldKey | typeof SKIP> = {}
  const used = new Set<SystemFieldKey>()
  for (const header of headers) {
    const lower = header.trim().toLowerCase()
    let match: SystemFieldKey | undefined
    for (const field of SYSTEM_FIELDS) {
      if (used.has(field.key) && !MULTI_COLUMN_FIELDS.includes(field.key)) continue
      if (HEADER_GUESSES[field.key].some((g) => lower.includes(g))) {
        match = field.key
        break
      }
    }
    if (match) {
      mapping[header] = match
      used.add(match)
    } else {
      mapping[header] = SKIP
    }
  }
  return mapping
}

// "اللغات التي تتقنها ومستواها [انجليزي]" + cell "ممتاز" -> "انجليزي: ممتاز"
function buildLanguagesValue(
  raw: Record<string, string>,
  languageHeaders: string[]
): string | null {
  const parts: string[] = []
  for (const header of languageHeaders) {
    const value = raw[header]?.trim()
    if (!value) continue
    const bracket = header.match(/\[(.+?)\]/)?.[1]?.trim()
    if (bracket) {
      parts.push(`${bracket}: ${value}`)
    } else {
      // columns like "لغات أخرى" — the cell already names the language(s)
      parts.push(value)
    }
  }
  return parts.length ? parts.join("، ") : null
}

const STATUS_GUESSES: Record<string, VolunteerStatus> = {
  active: "active", نشط: "active", فعال: "active",
  new: "new", جديد: "new",
  inactive: "inactive", "غير نشط": "inactive", "غير فعال": "inactive",
  "on hold": "on_hold", معلق: "on_hold",
  left: "archived", archived: "archived", مؤرشف: "archived", ترك: "archived",
}

function normalizeStatus(raw: string | undefined): VolunteerStatus {
  if (!raw) return "new"
  const lower = raw.trim().toLowerCase()
  for (const [key, status] of Object.entries(STATUS_GUESSES)) {
    if (lower.includes(key)) return status
  }
  return "new"
}

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, "")
  return digits || null
}

// ---------- component ----------

type Step = "upload" | "map" | "review" | "done"

interface ParsedRow {
  raw: Record<string, string>
}

interface PreparedRow {
  full_name: string
  phone: string | null
  email: string | null
  city: string | null
  university_id: string | null
  major: string | null
  departmentName: string | null
  resolvedDepartment: string | null
  skills: string | null
  languages: string | null
  availability: string | null
  status: VolunteerStatus
  internal_notes: string | null
  duplicate: { field: "email" | "phone" | "name" | "university ID"; existingId: string } | null
  invalid?: string
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  failed: number
}

export function ImportPage() {
  const { profile } = useAuth()
  const { data: departments = [] } = useDepartments()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Record<string, SystemFieldKey | typeof SKIP>>({})
  const [defaultDepartmentId, setDefaultDepartmentId] = useState<string | null>(null)
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip")
  const [prepared, setPrepared] = useState<PreparedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function ingestParsed(fields: string[], dataRows: Record<string, string>[]) {
    if (!fields.length || !dataRows.length) {
      toast.error("Couldn't read any rows from this file.")
      return
    }
    setHeaders(fields)
    setRows(dataRows.map((raw) => ({ raw })))
    setMapping(guessMapping(fields))
    setStep("map")
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    const lower = file.name.toLowerCase()

    if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
      // Excel file — read the first worksheet directly, no CSV export needed
      try {
        const ExcelJS = (await import("exceljs")).default
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const sheet = workbook.worksheets[0]
        if (!sheet) throw new Error("The workbook has no sheets")

        const headerRow = sheet.getRow(1)
        const fields: string[] = []
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          fields[colNumber - 1] = String(cell.text ?? cell.value ?? "").trim()
        })

        const dataRows: Record<string, string>[] = []
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return
          const record: Record<string, string> = {}
          let hasValue = false
          fields.forEach((field, index) => {
            if (!field) return
            const cell = row.getCell(index + 1)
            const value = String(cell.text ?? "").trim()
            record[field] = value
            if (value) hasValue = true
          })
          if (hasValue) dataRows.push(record)
        })

        ingestParsed(fields.filter(Boolean), dataRows)
      } catch (error) {
        toast.error(
          "Failed to read the Excel file" +
            (error instanceof Error ? `: ${error.message}` : "")
        )
      }
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (parsed) => ingestParsed(parsed.meta.fields ?? [], parsed.data),
      error: () => toast.error("Failed to parse the file."),
    })
  }

  const mappedFieldFor = (key: SystemFieldKey) =>
    Object.entries(mapping).find(([, v]) => v === key)?.[0]

  const canContinueFromMap = !!mappedFieldFor("full_name")

  async function prepareReview() {
    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]))

    const get = (row: ParsedRow, key: SystemFieldKey) => {
      const header = mappedFieldFor(key)
      return header ? row.raw[header]?.trim() || undefined : undefined
    }

    const languageHeaders = Object.entries(mapping)
      .filter(([, value]) => value === "languages")
      .map(([header]) => header)

    const preparedRows: PreparedRow[] = rows.map((row) => {
      const fullName = get(row, "full_name") ?? ""
      const email = get(row, "email")?.toLowerCase() || null
      const phone = normalizePhone(get(row, "phone"))
      const departmentName = get(row, "department") ?? null
      // exact department name match first, then keyword match on the free-text answer
      const resolvedDepartment =
        (departmentName && deptByName.has(departmentName.trim().toLowerCase())
          ? departments.find((d) => d.id === deptByName.get(departmentName.trim().toLowerCase()))?.name
          : null) ?? guessDepartmentFromValue(departmentName)
      return {
        full_name: fullName,
        phone,
        email,
        city: get(row, "city") ?? null,
        university_id: get(row, "university_id") ?? null,
        major: get(row, "major") ?? null,
        departmentName,
        resolvedDepartment,
        skills: get(row, "skills") ?? null,
        languages: buildLanguagesValue(row.raw, languageHeaders),
        availability: get(row, "availability") ?? null,
        status: normalizeStatus(get(row, "status")),
        internal_notes: get(row, "internal_notes") ?? null,
        duplicate: null,
        invalid: fullName.length < 2 ? "Missing name" : undefined,
      }
    })

    // detect duplicates against existing volunteers (by email, phone, university ID, or full name)
    const emails = preparedRows.map((r) => r.email).filter(Boolean) as string[]
    const phones = preparedRows.map((r) => r.phone).filter(Boolean) as string[]
    const universityIds = preparedRows.map((r) => r.university_id).filter(Boolean) as string[]

    const [emailRes, phoneRes, uniRes, namesRes] = await Promise.all([
      emails.length
        ? supabase.from("volunteer_private").select("volunteer_id, email").in("email", emails)
        : Promise.resolve({ data: [] as { volunteer_id: string; email: string | null }[] }),
      phones.length
        ? supabase.from("volunteer_private").select("volunteer_id, phone").in("phone", phones)
        : Promise.resolve({ data: [] as { volunteer_id: string; phone: string | null }[] }),
      universityIds.length
        ? supabase
            .from("volunteer_private")
            .select("volunteer_id, university_id")
            .in("university_id", universityIds)
        : Promise.resolve({ data: [] as { volunteer_id: string; university_id: string | null }[] }),
      supabase.from("volunteers").select("id, full_name"),
    ])

    const byEmail = new Map((emailRes.data ?? []).map((v) => [v.email, v.volunteer_id]))
    const byPhone = new Map((phoneRes.data ?? []).map((v) => [v.phone, v.volunteer_id]))
    const byUniversityId = new Map(
      (uniRes.data ?? []).map((v) => [v.university_id, v.volunteer_id])
    )
    // normalized full name -> id (tolerates Arabic spelling variants and extra spaces)
    const byName = new Map((namesRes.data ?? []).map((v) => [normalizeName(v.full_name), v.id]))

    for (const row of preparedRows) {
      const nameKey = normalizeName(row.full_name)
      if (row.email && byEmail.has(row.email)) {
        row.duplicate = { field: "email", existingId: byEmail.get(row.email)! }
      } else if (row.university_id && byUniversityId.has(row.university_id)) {
        row.duplicate = { field: "university ID", existingId: byUniversityId.get(row.university_id)! }
      } else if (row.phone && byPhone.has(row.phone)) {
        row.duplicate = { field: "phone", existingId: byPhone.get(row.phone)! }
      } else if (nameKey && byName.has(nameKey)) {
        row.duplicate = { field: "name", existingId: byName.get(nameKey)! }
      }
    }

    // also mark duplicates within the file itself (keep first occurrence)
    const seenEmail = new Set<string>()
    const seenPhone = new Set<string>()
    const seenUniversityId = new Set<string>()
    const seenName = new Set<string>()
    for (const row of preparedRows) {
      if (row.invalid || row.duplicate) continue
      if (row.email) {
        if (seenEmail.has(row.email)) row.invalid = "Duplicate inside file"
        seenEmail.add(row.email)
      }
      if (!row.invalid && row.phone) {
        if (seenPhone.has(row.phone)) row.invalid = "Duplicate inside file"
        seenPhone.add(row.phone)
      }
      if (!row.invalid && row.university_id) {
        if (seenUniversityId.has(row.university_id)) row.invalid = "Duplicate inside file"
        seenUniversityId.add(row.university_id)
      }
      const nameKey = normalizeName(row.full_name)
      if (!row.invalid && nameKey) {
        if (seenName.has(nameKey)) row.invalid = "Duplicate inside file"
        seenName.add(nameKey)
      }
    }

    setPrepared(preparedRows)
    setStep("review")
  }

  const reviewStats = useMemo(() => {
    const invalid = prepared.filter((r) => r.invalid).length
    const duplicates = prepared.filter((r) => !r.invalid && r.duplicate).length
    const fresh = prepared.length - invalid - duplicates
    return { invalid, duplicates, fresh }
  }, [prepared])

  async function runImport() {
    setImporting(true)
    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]))
    const counts: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: 0 }

    for (const row of prepared) {
      if (row.invalid) {
        counts.failed++
        continue
      }

      const departmentId =
        (row.resolvedDepartment && deptByName.get(row.resolvedDepartment.trim().toLowerCase())) ||
        (row.departmentName && deptByName.get(row.departmentName.trim().toLowerCase())) ||
        defaultDepartmentId ||
        null

      // shared columns vs. admin-only personal details (separate tables)
      const sharedPayload = {
        full_name: row.full_name,
        primary_department_id: departmentId,
        status: row.status,
        photo_url: null,
      }
      const privatePayload = {
        phone: row.phone,
        email: row.email,
        city: row.city,
        university_id: row.university_id,
        major: row.major,
        skills: row.skills,
        languages: row.languages,
        availability: row.availability,
        internal_notes: row.internal_notes,
      }

      try {
        let volunteerId: string

        if (row.duplicate) {
          if (duplicateAction === "skip") {
            counts.skipped++
            continue
          }
          volunteerId = row.duplicate.existingId
          const { error } = await supabase
            .from("volunteers")
            .update(sharedPayload)
            .eq("id", volunteerId)
          if (error) throw error
          counts.updated++
        } else {
          const { data, error } = await supabase
            .from("volunteers")
            .insert(sharedPayload)
            .select("id")
            .single()
          if (error) throw error
          volunteerId = data.id
          counts.imported++
        }

        const { error: privateError } = await supabase
          .from("volunteer_private")
          .upsert({ volunteer_id: volunteerId, ...privatePayload }, { onConflict: "volunteer_id" })
        if (privateError) throw privateError
      } catch {
        counts.failed++
      }
    }

    await supabase.from("import_logs").insert({
      imported_by: profile?.id ?? null,
      file_name: fileName,
      total_rows: prepared.length,
      successful_rows: counts.imported + counts.updated,
      failed_rows: counts.failed,
      duplicate_rows: counts.skipped,
      import_summary: { ...counts, duplicate_action: duplicateAction },
    })

    queryClient.invalidateQueries({ queryKey: ["volunteers"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })

    setResult(counts)
    setImporting(false)
    setStep("done")
  }

  function resetAll() {
    setStep("upload")
    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setPrepared([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import Data</h1>
        <p className="text-sm text-muted-foreground">
          Import volunteers from an Excel file (.xlsx) or a CSV exported from Google Sheets.
        </p>
      </div>

      {step === "upload" && (
        <Card>
          <CardContent>
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-20 transition-colors hover:border-primary/50 hover:bg-accent/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <UploadCloud className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Click to choose an Excel or CSV file, or drag it here
              </p>
              <p className="text-xs text-muted-foreground">
                .xlsx works directly — or export your Google Sheet as CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "upload" && <BulkPhotoUpload />}

      {step === "map" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="size-4" />
                {fileName}
                <Badge variant="secondary">{rows.length} rows</Badge>
              </CardTitle>
              <CardDescription>
                Match each column from your sheet to a system field. Columns set to "Don't import"
                are ignored. We guessed what we could.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {headers.some((h) => (mapping[h] ?? SKIP) === SKIP) && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="font-medium">
                    ⚠ I didn't recognize {headers.filter((h) => (mapping[h] ?? SKIP) === SKIP).length}{" "}
                    column{headers.filter((h) => (mapping[h] ?? SKIP) === SKIP).length === 1 ? "" : "s"} —
                    tell me where to put them:
                  </p>
                  <p className="mt-1">
                    {headers
                      .filter((h) => (mapping[h] ?? SKIP) === SKIP)
                      .map((h) => `"${h}"`)
                      .join("، ")}
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    Pick a field for each one below (highlighted in amber), or leave as "Don't
                    import" to skip it.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {headers.map((header) => (
                  <div
                    key={header}
                    className={
                      (mapping[header] ?? SKIP) === SKIP
                        ? "rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5"
                        : "rounded-lg border border-border p-3"
                    }
                  >
                    <p className="mb-1.5 truncate text-sm font-medium text-foreground" title={header}>
                      {header}
                    </p>
                    <p className="mb-2 truncate text-xs text-muted-foreground">
                      e.g. {rows[0]?.raw[header] || "—"}
                    </p>
                    <Select
                      value={mapping[header] ?? SKIP}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [header]: (v ?? SKIP) as SystemFieldKey | typeof SKIP }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>Don't import</SelectItem>
                        {SYSTEM_FIELDS.map((field) => (
                          <SelectItem
                            key={field.key}
                            value={field.key}
                            disabled={
                              mapping[header] !== field.key &&
                              !MULTI_COLUMN_FIELDS.includes(field.key) &&
                              Object.values(mapping).includes(field.key)
                            }
                          >
                            {field.label}
                            {field.required ? " *" : ""}
                            {MULTI_COLUMN_FIELDS.includes(field.key) ? " (multi)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground">
                    Default department (for rows without one)
                  </p>
                  <Select value={defaultDepartmentId} onValueChange={setDefaultDepartmentId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="No default — leave unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!canContinueFromMap && (
                <p className="text-sm text-destructive">
                  You must map one column to "Full Name" to continue.
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetAll}>
                  <ArrowLeft className="size-4" />
                  Start over
                </Button>
                <Button onClick={prepareReview} disabled={!canContinueFromMap}>
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review before import</CardTitle>
            <CardDescription>
              <span className="font-medium text-emerald-600">{reviewStats.fresh} new</span> ·{" "}
              <span className="font-medium text-amber-600">{reviewStats.duplicates} duplicates</span>{" "}
              (matched by email/phone) ·{" "}
              <span className="font-medium text-destructive">{reviewStats.invalid} invalid</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {reviewStats.duplicates > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">For duplicates:</p>
                <Select
                  value={duplicateAction}
                  onValueChange={(v) => setDuplicateAction((v ?? "skip") as "skip" | "update")}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip them (keep existing data)</SelectItem>
                    <SelectItem value="update">Update existing volunteers with sheet data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>University ID</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prepared.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.full_name || "—"}</TableCell>
                      <TableCell>{row.university_id ?? "—"}</TableCell>
                      <TableCell dir="ltr">{row.phone ?? "—"}</TableCell>
                      <TableCell>
                        {row.resolvedDepartment ? (
                          <Badge variant="secondary" className="text-xs">
                            {row.resolvedDepartment}
                          </Badge>
                        ) : row.departmentName ? (
                          <span
                            className="block max-w-40 truncate text-xs text-amber-600"
                            title={row.departmentName}
                          >
                            ? {row.departmentName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{row.status.replace("_", " ")}</TableCell>
                      <TableCell>
                        {row.invalid ? (
                          <Badge variant="destructive">{row.invalid}</Badge>
                        ) : row.duplicate ? (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            Duplicate ({row.duplicate.field})
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            New
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                <ArrowLeft className="size-4" />
                Back to mapping
              </Button>
              <Button onClick={runImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${reviewStats.fresh + (duplicateAction === "update" ? reviewStats.duplicates : 0)} volunteers`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="size-7" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Import complete</h2>
            <p className="text-sm text-muted-foreground">
              {result.imported} added · {result.updated} updated · {result.skipped} skipped ·{" "}
              {result.failed} failed
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={resetAll}>
                Import another file
              </Button>
              <Button render={<a href="/volunteers" />}>View volunteers</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
