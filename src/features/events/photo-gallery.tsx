import { useRef, useState } from "react"
import { ImagePlus, Images, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  useDeleteEventPhoto,
  useEventPhotos,
  useUploadEventPhotos,
  type EventPhotoWithBooth,
} from "./use-event-photos"

/**
 * Photo archive for an event. Used both on the event's Gallery tab (all
 * photos) and inside a single booth (photos of that booth only).
 */
export function PhotoGallery({
  eventId,
  boothId,
  canUpload = true,
  title = "Event photos",
}: {
  eventId: string
  boothId?: string
  canUpload?: boolean
  title?: string
}) {
  const { profile } = useAuth()
  const { data: photos = [], isLoading } = useEventPhotos(eventId, boothId)
  const uploadPhotos = useUploadEventPhotos()
  const deletePhoto = useDeleteEventPhoto()
  const inputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<EventPhotoWithBooth | null>(null)

  async function handleFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (!images.length) {
      toast.error("Please choose image files.")
      return
    }
    try {
      const count = await uploadPhotos.mutateAsync({
        eventId,
        boothId: boothId ?? null,
        files: images,
        uploadedBy: profile?.id ?? null,
      })
      toast.success(`${count} photo${count === 1 ? "" : "s"} added`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? "" : "s"} archived
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => inputRef.current?.click()} disabled={uploadPhotos.isPending}>
            <ImagePlus className="size-4" />
            {uploadPhotos.isPending ? "Uploading…" : "Add photos"}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <Card>
        <CardContent
          className={photos.length ? "" : "p-0"}
          onDragOver={canUpload ? (e) => e.preventDefault() : undefined}
          onDrop={
            canUpload
              ? (e) => {
                  e.preventDefault()
                  if (!uploadPhotos.isPending) handleFiles(e.dataTransfer.files)
                }
              : undefined
          }
        >
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading photos…</p>
          ) : photos.length === 0 ? (
            <EmptyState
              title="No photos yet"
              description={
                canUpload
                  ? "Add photos to keep an archive of this event — drag them here or use the button above."
                  : "Photos from this event will appear here."
              }
              icon={Images}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border"
                >
                  <button
                    type="button"
                    className="size-full cursor-zoom-in"
                    onClick={() => setLightbox(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption ?? "Event photo"}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>
                  {!boothId && photo.event_booths && (
                    <Badge className="pointer-events-none absolute bottom-1.5 left-1.5 text-[0.65rem]">
                      {photo.event_booths.name}
                    </Badge>
                  )}
                  {canUpload && (
                    <Button
                      size="icon-sm"
                      variant="destructive"
                      aria-label="Delete photo"
                      className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => deletePhoto.mutate(photo)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Event photo</DialogTitle>
          {lightbox && (
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? "Event photo"}
              className="max-h-[85svh] w-full object-contain"
            />
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Close"
            className="absolute top-2 right-2"
            onClick={() => setLightbox(null)}
          >
            <X className="size-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
