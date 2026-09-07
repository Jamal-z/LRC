import { useRef } from "react"
import { Download, Palette, Trash2, Upload, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  BG_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  COVER_HEIGHT_OPTIONS,
  DENSITY_OPTIONS,
  DESIGN_PRESETS,
  FONT_OPTIONS,
  HEADER_STYLES,
  QUESTION_STYLES,
  RADIUS_OPTIONS,
  SHADOW_OPTIONS,
  SKIN_HOOKS,
  TITLE_SIZES,
  WIDTH_OPTIONS,
  applyPreset,
  backgroundLayers,
  splitUploadedHtml,
  starterSkinHtml,
} from "./form-design"
import type { FormDesign } from "@/types/database.types"

type Design = Required<FormDesign>

interface DesignPanelProps {
  design: Design
  onChange: (patch: Partial<Design>) => void
  onReplace: (design: Design) => void
  accentColor: string
  onAccentColor: (color: string) => void
  customCss: string
  onCustomCss: (css: string) => void
  customHeaderHtml: string
  onCustomHeaderHtml: (html: string) => void
  formTitle: string
}

/* ------------------------------------------------------------------ */
/* Small controls                                                      */
/* ------------------------------------------------------------------ */

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
            value === option.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent/50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="text"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-[5.5rem] rounded border border-border bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground outline-none focus:border-primary"
        />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded border border-border bg-transparent"
        />
      </span>
    </label>
  )
}

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

const ACCENT_SWATCHES = [
  "#2563eb", "#0ea5e9", "#06b6d4", "#14b8a6", "#059669", "#65a30d",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#7c3aed",
  "#0f172a", "#475569", "#b45309", "#be123c",
]

/* ------------------------------------------------------------------ */

export function FormDesignPanel({
  design,
  onChange,
  onReplace,
  accentColor,
  onAccentColor,
  customCss,
  onCustomCss,
  customHeaderHtml,
  onCustomHeaderHtml,
  formTitle,
}: DesignPanelProps) {
  const skinInputRef = useRef<HTMLInputElement>(null)

  async function handleSkinUpload(file: File) {
    if (file.size > 400_000) {
      toast.error("That file is too big — 400KB max")
      return
    }
    const raw = await file.text()
    const { css, html } = splitUploadedHtml(raw)
    if (!css && !html) {
      toast.error("No <style> or markup found in that file")
      return
    }
    onCustomCss(css)
    onCustomHeaderHtml(html)
    toast.success("Skin applied — check the preview")
  }

  function downloadStarter() {
    const blob = new Blob([starterSkinHtml(formTitle || "LRC form")], {
      type: "text/html;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "lrc-form-skin.html"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Tabs defaultValue="presets">
      <TabsList className="w-full flex-wrap">
        <TabsTrigger value="presets">Presets</TabsTrigger>
        <TabsTrigger value="background">Background</TabsTrigger>
        <TabsTrigger value="card">Card</TabsTrigger>
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="type">Type</TabsTrigger>
        <TabsTrigger value="header">Cover</TabsTrigger>
        <TabsTrigger value="button">Button</TabsTrigger>
        <TabsTrigger value="custom">HTML</TabsTrigger>
      </TabsList>

      {/* ---------------- presets ---------------- */}
      <TabsContent value="presets" className="flex flex-col gap-4 pt-3">
        <Section
          label="Ready-made themes"
          hint="Pick one as a starting point, then change anything from the other tabs."
        >
          <div className="grid grid-cols-2 gap-2">
            {DESIGN_PRESETS.map((preset) => {
              const previewDesign = applyPreset(preset)
              const active = design.preset === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onReplace(applyPreset(preset))
                    onAccentColor(preset.accent)
                  }}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border p-2 text-start transition-all",
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span
                    className="relative flex h-16 w-full items-end overflow-hidden rounded-lg border border-black/5 p-1.5"
                    style={backgroundLayers(previewDesign)}
                  >
                    <span
                      className="h-8 w-full rounded"
                      style={{
                        background: previewDesign.cardBg,
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
                        borderTop: `3px solid ${preset.accent}`,
                      }}
                    />
                  </span>
                  <span className="text-xs font-semibold text-foreground">{preset.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section label="Accent colour" hint="Buttons, question numbers and small details.">
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => onAccentColor(color)}
                className="size-7 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  boxShadow:
                    accentColor === color
                      ? `0 0 0 2px var(--background), 0 0 0 4px ${color}`
                      : undefined,
                }}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ColorField label="Accent" value={accentColor} onChange={onAccentColor} />
            <ColorField
              label="Gradient to"
              value={design.accentTo}
              onChange={(v) => onChange({ accentTo: v })}
            />
          </div>
          <ToggleRow
            label="Gradient on the button and top bar"
            checked={design.accentGradient}
            onChange={(v) => onChange({ accentGradient: v })}
          />
        </Section>

        <Section label="Form width" hint="Wider gives the questions more room.">
          <ChoiceGrid
            options={WIDTH_OPTIONS.map((w) => ({ value: w.value, label: w.label }))}
            value={design.width}
            onChange={(v) => onChange({ width: v })}
          />
        </Section>

        <Section label="Spacing between questions">
          <ChoiceGrid
            options={DENSITY_OPTIONS}
            value={design.density}
            onChange={(v) => onChange({ density: v })}
            columns={3}
          />
        </Section>

        <Section label="Corner rounding">
          <ChoiceGrid
            options={RADIUS_OPTIONS}
            value={design.radius}
            onChange={(v) => onChange({ radius: v })}
            columns={3}
          />
        </Section>
      </TabsContent>

      {/* ---------------- background ---------------- */}
      <TabsContent value="background" className="flex flex-col gap-4 pt-3">
        <Section label="Background style">
          <ChoiceGrid
            options={BG_STYLES}
            value={design.bgStyle}
            onChange={(v) => onChange({ bgStyle: v })}
          />
        </Section>

        <Section label="Background colours">
          <div className="grid gap-2">
            <ColorField label="From" value={design.bgFrom} onChange={(v) => onChange({ bgFrom: v })} />
            <ColorField label="Middle" value={design.bgVia} onChange={(v) => onChange({ bgVia: v })} />
            <ColorField label="To" value={design.bgTo} onChange={(v) => onChange({ bgTo: v })} />
          </div>
          <SliderField
            label="Gradient angle"
            value={design.bgAngle}
            onChange={(v) => onChange({ bgAngle: v })}
            max={360}
            suffix="°"
          />
        </Section>

        <Section label="Pattern colour" hint="Used by dots, grid, stripes and glow.">
          <ColorField
            label="Pattern"
            value={design.bgPatternColor}
            onChange={(v) => onChange({ bgPatternColor: v })}
          />
          <SliderField
            label="Pattern opacity"
            value={design.bgPatternOpacity}
            onChange={(v) => onChange({ bgPatternOpacity: v })}
            max={60}
          />
        </Section>

        {design.bgStyle === "image" && (
          <Section label="Background image" hint="Paste an image URL — 1600px wide or more works best.">
            <Input
              dir="ltr"
              placeholder="https://…"
              value={design.bgImageUrl ?? ""}
              onChange={(e) => onChange({ bgImageUrl: e.target.value || null })}
            />
            <SliderField
              label="Tint over the image"
              value={design.bgImageOverlay}
              onChange={(v) => onChange({ bgImageOverlay: v })}
            />
          </Section>
        )}
      </TabsContent>

      {/* ---------------- card ---------------- */}
      <TabsContent value="card" className="flex flex-col gap-4 pt-3">
        <Section label="Card style">
          <ChoiceGrid
            options={CARD_STYLES}
            value={design.cardStyle}
            onChange={(v) => onChange({ cardStyle: v })}
          />
        </Section>

        <Section label="Card colours">
          <div className="grid gap-2">
            <ColorField label="Background" value={design.cardBg} onChange={(v) => onChange({ cardBg: v })} />
            <ColorField
              label="Border"
              value={design.cardBorderColor}
              onChange={(v) => onChange({ cardBorderColor: v })}
            />
          </div>
          <SliderField
            label="Card opacity"
            value={design.cardOpacity}
            onChange={(v) => onChange({ cardOpacity: v })}
            min={20}
          />
        </Section>

        <Section label="Shadow">
          <ChoiceGrid
            options={SHADOW_OPTIONS}
            value={design.cardShadow}
            onChange={(v) => onChange({ cardShadow: v })}
            columns={3}
          />
        </Section>

        <Section label="Extras">
          <ToggleRow
            label="Progress bar"
            hint="Shows how much of the form is filled in"
            checked={design.progressBar}
            onChange={(v) => onChange({ progressBar: v })}
          />
          <ToggleRow
            label="Smooth transitions"
            checked={design.animate}
            onChange={(v) => onChange({ animate: v })}
          />
          <ToggleRow
            label="Centre logo above the form"
            checked={design.showLogo}
            onChange={(v) => onChange({ showLogo: v })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- questions ---------------- */}
      <TabsContent value="questions" className="flex flex-col gap-4 pt-3">
        <Section label="Question block style" hint="The area holding each question and its answer.">
          <ChoiceGrid
            options={QUESTION_STYLES}
            value={design.questionStyle}
            onChange={(v) => onChange({ questionStyle: v })}
          />
        </Section>

        <Section label="Question block colours">
          <div className="grid gap-2">
            <ColorField
              label="Question background"
              value={design.questionBg}
              onChange={(v) => onChange({ questionBg: v })}
            />
            <ColorField
              label="Question border"
              value={design.questionBorderColor}
              onChange={(v) => onChange({ questionBorderColor: v })}
            />
            <ColorField
              label="Question text"
              value={design.questionTextColor}
              onChange={(v) => onChange({ questionTextColor: v })}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["#ffffff", "#f8fafc", "#f0f9ff", "#eff6ff", "#f5f3ff", "#fff7ed", "#ecfdf5", "#fffbeb", "#111c33", "transparent"].map(
              (color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => onChange({ questionBg: color })}
                  className="size-7 rounded-lg border border-border transition-transform hover:scale-110"
                  style={{
                    background:
                      color === "transparent"
                        ? "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50%/8px 8px"
                        : color,
                    boxShadow:
                      design.questionBg === color
                        ? "0 0 0 2px var(--background), 0 0 0 4px var(--primary)"
                        : undefined,
                  }}
                />
              )
            )}
          </div>
        </Section>

        <Section label="Details">
          <ToggleRow
            label="Number the questions"
            checked={design.questionNumbers}
            onChange={(v) => onChange({ questionNumbers: v })}
          />
          <ToggleRow
            label="Accent bar on the question edge"
            hint="Applies to the card-per-question style"
            checked={design.questionAccentBar}
            onChange={(v) => onChange({ questionAccentBar: v })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- typography ---------------- */}
      <TabsContent value="type" className="flex flex-col gap-4 pt-3">
        <Section label="Font" hint="Arabic faces that stay readable on a phone.">
          <div className="flex flex-col gap-1.5">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => onChange({ font: font.value })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                  design.font === font.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:bg-accent/50"
                )}
                style={{ fontFamily: font.stack }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Title size">
          <ChoiceGrid
            options={TITLE_SIZES.map((t) => ({ value: t.value, label: t.label }))}
            value={design.titleSize}
            onChange={(v) => onChange({ titleSize: v })}
            columns={4}
          />
        </Section>

        <Section label="Text colours">
          <div className="grid gap-2">
            <ColorField
              label="Headings"
              value={design.headingColor}
              onChange={(v) => onChange({ headingColor: v })}
            />
            <ColorField
              label="Body text"
              value={design.bodyColor}
              onChange={(v) => onChange({ bodyColor: v })}
            />
          </div>
        </Section>

        <Section label="Footer note" hint="Leave empty to keep the default signature.">
          <Input
            placeholder="e.g. Any questions? Reach us at…"
            value={design.footerNote}
            onChange={(e) => onChange({ footerNote: e.target.value })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- header / cover ---------------- */}
      <TabsContent value="header" className="flex flex-col gap-4 pt-3">
        <Section label="Cover layout">
          <ChoiceGrid
            options={HEADER_STYLES}
            value={design.headerStyle}
            onChange={(v) => onChange({ headerStyle: v })}
          />
        </Section>

        <Section label="Cover image size" hint="Huge lets the image fill the top of the page.">
          <ChoiceGrid
            options={COVER_HEIGHT_OPTIONS}
            value={design.coverHeight}
            onChange={(v) => onChange({ coverHeight: v })}
            columns={3}
          />
        </Section>

        <Section label="Tint over the cover">
          <SliderField
            label="Tint strength"
            value={design.coverOverlay}
            onChange={(v) => onChange({ coverOverlay: v })}
            max={80}
          />
        </Section>
      </TabsContent>

      {/* ---------------- button ---------------- */}
      <TabsContent value="button" className="flex flex-col gap-4 pt-3">
        <Section label="Submit button style">
          <ChoiceGrid
            options={BUTTON_STYLES}
            value={design.buttonStyle}
            onChange={(v) => onChange({ buttonStyle: v })}
          />
        </Section>

        <Section label="Button rounding">
          <ChoiceGrid
            options={[...RADIUS_OPTIONS, { value: "pill" as const, label: "Pill" }]}
            value={design.buttonRadius}
            onChange={(v) => onChange({ buttonRadius: v })}
            columns={3}
          />
        </Section>

        <Section label="Button width">
          <ChoiceGrid
            options={[
              { value: "full" as const, label: "Full width" },
              { value: "auto" as const, label: "Fit to text" },
            ]}
            value={design.buttonWidth}
            onChange={(v) => onChange({ buttonWidth: v })}
          />
        </Section>

        <Section label="Button label" hint="Leave empty for the bilingual default.">
          <Input
            placeholder="إرسال / Submit"
            value={design.buttonLabel}
            onChange={(e) => onChange({ buttonLabel: e.target.value })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- custom skin ---------------- */}
      <TabsContent value="custom" className="flex flex-col gap-4 pt-3">
        <Section
          label="Upload a ready-made HTML design"
          hint="Upload an .html file — we take its <style> and markup and apply them on top. Scripts are stripped, because the form page is public."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => skinInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload HTML
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadStarter}>
              <Download className="size-4" />
              Download a starter
            </Button>
            {(customCss || customHeaderHtml) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  onCustomCss("")
                  onCustomHeaderHtml("")
                  toast.success("Uploaded skin cleared")
                }}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
            )}
          </div>
          <input
            ref={skinInputRef}
            type="file"
            accept=".html,.htm,text/html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleSkinUpload(file)
              e.target.value = ""
            }}
          />
        </Section>

        <Section label="Custom CSS" hint="Applied on top of every option above — it always wins.">
          <Textarea
            dir="ltr"
            rows={8}
            className="font-mono text-xs"
            placeholder={".lrc-card { border-top: 6px solid #2563eb; }"}
            value={customCss}
            onChange={(e) => onCustomCss(e.target.value)}
          />
        </Section>

        <Section label="HTML above the questions" hint="Rendered inside the card, before the first question.">
          <Textarea
            dir="ltr"
            rows={5}
            className="font-mono text-xs"
            placeholder={'<div class="lrc-header">…</div>'}
            value={customHeaderHtml}
            onChange={(e) => onCustomHeaderHtml(e.target.value)}
          />
        </Section>

        <Section label="Class hooks you can style">
          <div className="rounded-lg border border-border bg-muted/40 p-2.5">
            <ul className="flex flex-col gap-1">
              {SKIN_HOOKS.map((hook) => (
                <li key={hook.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <code dir="ltr" className="font-mono text-primary">
                    {hook.name}
                  </code>
                  <span className="text-muted-foreground">{hook.what}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </TabsContent>
    </Tabs>
  )
}

export { Palette as DesignIcon, Wand2 as PresetIcon }
