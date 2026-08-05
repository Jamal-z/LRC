import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { EventPhotoRow } from "@/types/database.types"

export interface EventPhotoWithBooth extends EventPhotoRow {
  event_booths: { id: string; name: string } | null
}

export function useEventPhotos(eventId: string | undefined, boothId?: string) {
  return useQuery({
    queryKey: ["event-photos", eventId, boothId ?? "all"],
    queryFn: async (): Promise<EventPhotoWithBooth[]> => {
      let query = supabase
        .from("event_photos")
        .select("*, event_booths:booth_id (id, name)")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false })
      if (boothId) query = query.eq("booth_id", boothId)
      const { data, error } = await query
      if (error) throw error
      return data as unknown as EventPhotoWithBooth[]
    },
    enabled: !!eventId,
  })
}

export function useUploadEventPhotos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      boothId,
      files,
      uploadedBy,
    }: {
      eventId: string
      boothId?: string | null
      files: File[]
      uploadedBy: string | null
    }) => {
      let uploaded = 0
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `events/${eventId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true })
        if (uploadError) throw uploadError

        const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl
        const { error: insertError } = await supabase.from("event_photos").insert({
          event_id: eventId,
          booth_id: boothId ?? null,
          url,
          path,
          uploaded_by: uploadedBy,
        })
        if (insertError) throw insertError
        uploaded++
      }
      return uploaded
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-photos"] }),
  })
}

export function useDeleteEventPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (photo: EventPhotoRow) => {
      const { error } = await supabase.from("event_photos").delete().eq("id", photo.id)
      if (error) throw error
      // best-effort cleanup of the stored file
      await supabase.storage.from("avatars").remove([photo.path])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-photos"] }),
  })
}
