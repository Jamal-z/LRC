import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { BoothProposalRow } from "@/types/database.types"

export interface BoothProposalWithAuthor extends BoothProposalRow {
  profiles: { id: string; full_name: string } | null
}

export function useBoothProposals(boothId: string | undefined) {
  return useQuery({
    queryKey: ["booth-proposals", boothId],
    queryFn: async (): Promise<BoothProposalWithAuthor[]> => {
      const { data, error } = await supabase
        .from("booth_proposals")
        .select("*, profiles:created_by (id, full_name)")
        .eq("booth_id", boothId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as BoothProposalWithAuthor[]
    },
    enabled: !!boothId,
  })
}

/** Every proposal across the center — used by the committee's overview. */
export function useAllBoothProposals() {
  return useQuery({
    queryKey: ["booth-proposals", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booth_proposals")
        .select(
          "*, profiles:created_by (id, full_name), event_booths:booth_id (id, name), events:event_id (id, name, date)"
        )
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as (BoothProposalWithAuthor & {
        event_booths: { id: string; name: string } | null
        events: { id: string; name: string; date: string } | null
      })[]
    },
  })
}

export function useSaveBoothProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boothId,
      eventId,
      title,
      notes,
      requestedItems,
      file,
      createdBy,
    }: {
      boothId: string
      eventId: string
      title: string
      notes: string | null
      requestedItems: string | null
      file: File | null
      createdBy: string | null
    }) => {
      let fileUrl: string | null = null
      let filePath: string | null = null
      let fileName: string | null = null

      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf"
        filePath = `proposals/${boothId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, file, { upsert: true })
        if (uploadError) throw uploadError

        // the attachments bucket is private, so hand out a long-lived signed URL
        const { data: signed, error: signError } = await supabase.storage
          .from("attachments")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365)
        if (signError) throw signError
        fileUrl = signed.signedUrl
        fileName = file.name
      }

      const { error } = await supabase.from("booth_proposals").insert({
        booth_id: boothId,
        event_id: eventId,
        title,
        notes,
        requested_items: requestedItems,
        file_url: fileUrl,
        file_path: filePath,
        file_name: fileName,
        created_by: createdBy,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booth-proposals"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

export function useReviewBoothProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewNotes,
      reviewerId,
    }: {
      id: string
      status: "approved" | "rejected"
      reviewNotes: string | null
      reviewerId: string | null
    }) => {
      const { error } = await supabase
        .from("booth_proposals")
        .update({
          status,
          review_notes: reviewNotes,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booth-proposals"] }),
  })
}

export function useDeleteBoothProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (proposal: BoothProposalRow) => {
      const { error } = await supabase.from("booth_proposals").delete().eq("id", proposal.id)
      if (error) throw error
      if (proposal.file_path) {
        await supabase.storage.from("attachments").remove([proposal.file_path])
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booth-proposals"] }),
  })
}
