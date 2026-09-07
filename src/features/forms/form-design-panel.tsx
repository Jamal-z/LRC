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
      toast.error("الملف كبير — أقصى حجم 400KB")
      return
    }
    const raw = await file.text()
    const { css, html } = splitUploadedHtml(raw)
    if (!css && !html) {
      toast.error("لم نجد أي <style> أو محتوى في الملف")
      return
    }
    onCustomCss(css)
    onCustomHeaderHtml(html)
    toast.success("تم تطبيق التصميم المرفوع — شوف المعاينة")
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
        <TabsTrigger value="presets">جاهز</TabsTrigger>
        <TabsTrigger value="background">الخلفية</TabsTrigger>
        <TabsTrigger value="card">البطاقة</TabsTrigger>
        <TabsTrigger value="questions">الأسئلة</TabsTrigger>
        <TabsTrigger value="type">الخط</TabsTrigger>
        <TabsTrigger value="header">الغلاف</TabsTrigger>
        <TabsTrigger value="button">الزر</TabsTrigger>
        <TabsTrigger value="custom">HTML</TabsTrigger>
      </TabsList>

      {/* ---------------- presets ---------------- */}
      <TabsContent value="presets" className="flex flex-col gap-4 pt-3">
        <Section
          label="تصاميم جاهزة"
          hint="اختر تصميم كبداية، وبعدها عدّل أي شي فيه من باقي التبويبات."
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

        <Section label="اللون الأساسي" hint="لون الأزرار والأرقام والتفاصيل.">
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
            <ColorField label="أساسي" value={accentColor} onChange={onAccentColor} />
            <ColorField
              label="التدرّج"
              value={design.accentTo}
              onChange={(v) => onChange({ accentTo: v })}
            />
          </div>
          <ToggleRow
            label="تدرّج لوني للزر والشريط"
            checked={design.accentGradient}
            onChange={(v) => onChange({ accentGradient: v })}
          />
        </Section>

        <Section label="عرض الفورم" hint="أوسع = مساحة أكبر للأسئلة.">
          <ChoiceGrid
            options={WIDTH_OPTIONS.map((w) => ({ value: w.value, label: w.label }))}
            value={design.width}
            onChange={(v) => onChange({ width: v })}
          />
        </Section>

        <Section label="التباعد بين الأسئلة">
          <ChoiceGrid
            options={DENSITY_OPTIONS}
            value={design.density}
            onChange={(v) => onChange({ density: v })}
            columns={3}
          />
        </Section>

        <Section label="استدارة الحواف">
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
        <Section label="نمط الخلفية">
          <ChoiceGrid
            options={BG_STYLES}
            value={design.bgStyle}
            onChange={(v) => onChange({ bgStyle: v })}
          />
        </Section>

        <Section label="ألوان الخلفية">
          <div className="grid gap-2">
            <ColorField label="من" value={design.bgFrom} onChange={(v) => onChange({ bgFrom: v })} />
            <ColorField label="الوسط" value={design.bgVia} onChange={(v) => onChange({ bgVia: v })} />
            <ColorField label="إلى" value={design.bgTo} onChange={(v) => onChange({ bgTo: v })} />
          </div>
          <SliderField
            label="زاوية التدرّج"
            value={design.bgAngle}
            onChange={(v) => onChange({ bgAngle: v })}
            max={360}
            suffix="°"
          />
        </Section>

        <Section label="لون النقش" hint="لون النقاط / الشبكة / الخطوط / الهالات.">
          <ColorField
            label="لون النقش"
            value={design.bgPatternColor}
            onChange={(v) => onChange({ bgPatternColor: v })}
          />
          <SliderField
            label="شفافية النقش"
            value={design.bgPatternOpacity}
            onChange={(v) => onChange({ bgPatternOpacity: v })}
            max={60}
          />
        </Section>

        {design.bgStyle === "image" && (
          <Section label="صورة الخلفية" hint="الصق رابط صورة (يفضّل عرض 1600px أو أكثر).">
            <Input
              dir="ltr"
              placeholder="https://…"
              value={design.bgImageUrl ?? ""}
              onChange={(e) => onChange({ bgImageUrl: e.target.value || null })}
            />
            <SliderField
              label="تعتيم فوق الصورة"
              value={design.bgImageOverlay}
              onChange={(v) => onChange({ bgImageOverlay: v })}
            />
          </Section>
        )}
      </TabsContent>

      {/* ---------------- card ---------------- */}
      <TabsContent value="card" className="flex flex-col gap-4 pt-3">
        <Section label="شكل البطاقة">
          <ChoiceGrid
            options={CARD_STYLES}
            value={design.cardStyle}
            onChange={(v) => onChange({ cardStyle: v })}
          />
        </Section>

        <Section label="ألوان البطاقة">
          <div className="grid gap-2">
            <ColorField label="خلفية" value={design.cardBg} onChange={(v) => onChange({ cardBg: v })} />
            <ColorField
              label="الإطار"
              value={design.cardBorderColor}
              onChange={(v) => onChange({ cardBorderColor: v })}
            />
          </div>
          <SliderField
            label="شفافية البطاقة"
            value={design.cardOpacity}
            onChange={(v) => onChange({ cardOpacity: v })}
            min={20}
          />
        </Section>

        <Section label="الظل">
          <ChoiceGrid
            options={SHADOW_OPTIONS}
            value={design.cardShadow}
            onChange={(v) => onChange({ cardShadow: v })}
            columns={3}
          />
        </Section>

        <Section label="لمسات">
          <ToggleRow
            label="شريط التقدّم"
            hint="يبيّن قدّيش عبّى من الفورم"
            checked={design.progressBar}
            onChange={(v) => onChange({ progressBar: v })}
          />
          <ToggleRow
            label="حركات ناعمة"
            checked={design.animate}
            onChange={(v) => onChange({ animate: v })}
          />
          <ToggleRow
            label="شعار المركز فوق الفورم"
            checked={design.showLogo}
            onChange={(v) => onChange({ showLogo: v })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- questions ---------------- */}
      <TabsContent value="questions" className="flex flex-col gap-4 pt-3">
        <Section label="شكل منطقة السؤال" hint="هاي المنطقة الي فيها كل سؤال وجوابه.">
          <ChoiceGrid
            options={QUESTION_STYLES}
            value={design.questionStyle}
            onChange={(v) => onChange({ questionStyle: v })}
          />
        </Section>

        <Section label="ألوان منطقة الأسئلة">
          <div className="grid gap-2">
            <ColorField
              label="خلفية السؤال"
              value={design.questionBg}
              onChange={(v) => onChange({ questionBg: v })}
            />
            <ColorField
              label="إطار السؤال"
              value={design.questionBorderColor}
              onChange={(v) => onChange({ questionBorderColor: v })}
            />
            <ColorField
              label="لون نص السؤال"
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

        <Section label="تفاصيل">
          <ToggleRow
            label="ترقيم الأسئلة"
            checked={design.questionNumbers}
            onChange={(v) => onChange({ questionNumbers: v })}
          />
          <ToggleRow
            label="شريط ملوّن على حافة السؤال"
            hint="يشتغل مع نمط «بطاقة لكل سؤال»"
            checked={design.questionAccentBar}
            onChange={(v) => onChange({ questionAccentBar: v })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- typography ---------------- */}
      <TabsContent value="type" className="flex flex-col gap-4 pt-3">
        <Section label="الخط" hint="خطوط عربية مريحة للقراءة على الموبايل.">
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

        <Section label="حجم العنوان">
          <ChoiceGrid
            options={TITLE_SIZES.map((t) => ({ value: t.value, label: t.label }))}
            value={design.titleSize}
            onChange={(v) => onChange({ titleSize: v })}
            columns={4}
          />
        </Section>

        <Section label="ألوان النص">
          <div className="grid gap-2">
            <ColorField
              label="العنوان"
              value={design.headingColor}
              onChange={(v) => onChange({ headingColor: v })}
            />
            <ColorField
              label="النص العادي"
              value={design.bodyColor}
              onChange={(v) => onChange({ bodyColor: v })}
            />
          </div>
        </Section>

        <Section label="نص أسفل الفورم" hint="اتركه فاضي ليضل التوقيع الافتراضي.">
          <Input
            placeholder="مثلاً: لأي استفسار تواصل معنا على…"
            value={design.footerNote}
            onChange={(e) => onChange({ footerNote: e.target.value })}
          />
        </Section>
      </TabsContent>

      {/* ---------------- header / cover ---------------- */}
      <TabsContent value="header" className="flex flex-col gap-4 pt-3">
        <Section label="طريقة عرض الغلاف">
          <ChoiceGrid
            options={HEADER_STYLES}
            value={design.headerStyle}
            onChange={(v) => onChange({ headerStyle: v })}
          />
        </Section>

        <Section label="حجم صورة الغلاف" hint="«ضخمة» بتخلي الصورة تملأ أعلى الصفحة.">
          <ChoiceGrid
            options={COVER_HEIGHT_OPTIONS}
            value={design.coverHeight}
            onChange={(v) => onChange({ coverHeight: v })}
            columns={3}
          />
        </Section>

        <Section label="تلوين فوق الصورة">
          <SliderField
            label="شفافية اللون فوق الصورة"
            value={design.coverOverlay}
            onChange={(v) => onChange({ coverOverlay: v })}
            max={80}
          />
        </Section>
      </TabsContent>

      {/* ---------------- button ---------------- */}
      <TabsContent value="button" className="flex flex-col gap-4 pt-3">
        <Section label="شكل زر الإرسال">
          <ChoiceGrid
            options={BUTTON_STYLES}
            value={design.buttonStyle}
            onChange={(v) => onChange({ buttonStyle: v })}
          />
        </Section>

        <Section label="استدارة الزر">
          <ChoiceGrid
            options={[...RADIUS_OPTIONS, { value: "pill" as const, label: "كبسولة" }]}
            value={design.buttonRadius}
            onChange={(v) => onChange({ buttonRadius: v })}
            columns={3}
          />
        </Section>

        <Section label="عرض الزر">
          <ChoiceGrid
            options={[
              { value: "full" as const, label: "بعرض الفورم" },
              { value: "auto" as const, label: "بحجم النص" },
            ]}
            value={design.buttonWidth}
            onChange={(v) => onChange({ buttonWidth: v })}
          />
        </Section>

        <Section label="نص الزر" hint="اتركه فاضي لـ «إرسال / Submit».">
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
          label="ارفع تصميم HTML جاهز"
          hint="ارفع ملف .html — بناخد منه الـ <style> والماركب ونطبّقهم فوق التصميم. أي سكربت بينشال لأن الصفحة عامة."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => skinInputRef.current?.click()}>
              <Upload className="size-4" />
              ارفع ملف HTML
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadStarter}>
              <Download className="size-4" />
              نزّل قالب للبداية
            </Button>
            {(customCss || customHeaderHtml) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  onCustomCss("")
                  onCustomHeaderHtml("")
                  toast.success("تم مسح التصميم المرفوع")
                }}
              >
                <Trash2 className="size-4" />
                امسح
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

        <Section label="CSS مخصّص" hint="بينطبّق فوق كل الخيارات — آخر كلمة إلك.">
          <Textarea
            dir="ltr"
            rows={8}
            className="font-mono text-xs"
            placeholder={".lrc-card { border-top: 6px solid #2563eb; }"}
            value={customCss}
            onChange={(e) => onCustomCss(e.target.value)}
          />
        </Section>

        <Section label="HTML فوق الأسئلة" hint="بيظهر جوّا البطاقة قبل أول سؤال.">
          <Textarea
            dir="ltr"
            rows={5}
            className="font-mono text-xs"
            placeholder={'<div class="lrc-header">…</div>'}
            value={customHeaderHtml}
            onChange={(e) => onCustomHeaderHtml(e.target.value)}
          />
        </Section>

        <Section label="أسماء الكلاسات الي بتقدر تلوّنها">
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
