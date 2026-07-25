"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { reorderMediaAction } from "../server/portfolio-cms-actions";

export interface PortfolioMediaItem {
  id: string;
  project_id: string;
  public_object_path: string | null;
  media_role: string;
  status: string;
  alt_text: string;
  caption: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | null;
  sort_order: number;
}

interface PortfolioMediaManagerProps {
  projectId: string;
  isPublished: boolean;
  mediaItems: PortfolioMediaItem[];
}

export function PortfolioMediaManager({
  projectId,
  isPublished,
  mediaItems,
}: PortfolioMediaManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [mediaRole, setMediaRole] = useState<"cover" | "gallery">("gallery");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !altText.trim()) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage("Processing image on server...");

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("mediaRole", mediaRole);
      formData.append("altText", altText.trim());
      if (caption.trim()) formData.append("caption", caption.trim());
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/portfolio/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setUploadError(data.error || "Upload failed");
        setUploadMessage(null);
      } else {
        setUploadMessage("Image processed and uploaded successfully");
        setAltText("");
        setCaption("");
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById("portfolio-file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        router.refresh();
      }
    } catch {
      setUploadError("Network or server error during upload");
      setUploadMessage(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMedia(mediaId: string, role: string) {
    if (isPublished && role === "cover") {
      alert("Cannot delete ready cover image of a published project. Return project to draft first.");
      return;
    }

    if (!confirm("Are you sure you want to delete this media item?")) return;

    try {
      const res = await fetch(`/api/admin/portfolio/media/${mediaId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Failed to delete media");
      } else {
        router.refresh();
      }
    } catch {
      alert("Error contacting server for media deletion");
    }
  }

  function handleReorder(mediaId: string, direction: "up" | "down") {
    startTransition(async () => {
      await reorderMediaAction(projectId, mediaId, direction);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-lg border border-[#E5E0DA] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-serif font-semibold text-[#1A1A1A]">Media Gallery & Covers</h2>
      <p className="mt-1 text-sm text-[#666059]">
        Upload raw photograph files (JPEG, PNG, WebP up to 20 MiB). Private masters are stored securely in portfolio-originals; WebP derivatives and thumbnails are served via portfolio-public.
      </p>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="mt-6 rounded-md border border-[#E5E0DA] bg-[#F9F7F5] p-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Upload New Media</h3>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[#1A1A1A]" htmlFor="portfolio-file-input">
              Select Image File (Max 20 MiB)
            </label>
            <input
              id="portfolio-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={uploading}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs text-stone-600 file:mr-3 file:rounded file:border-0 file:bg-[#1A1A1A] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#333333]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1A1A1A]" htmlFor="mediaRole">
              Media Role
            </label>
            <select
              id="mediaRole"
              value={mediaRole}
              disabled={uploading}
              onChange={(e) => setMediaRole(e.target.value as "cover" | "gallery")}
              className="mt-1 block w-full rounded border border-[#E5E0DA] bg-white p-2 text-xs text-[#1A1A1A]"
            >
              <option value="gallery">Gallery Image</option>
              <option value="cover">Project Cover Image</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium text-[#1A1A1A]" htmlFor="altText">
            Alt Text (Accessible Description)
          </label>
          <input
            id="altText"
            type="text"
            required
            minLength={3}
            maxLength={200}
            value={altText}
            disabled={uploading}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="e.g. Living room featuring custom walnut wall paneling"
            className="mt-1 block w-full rounded border border-[#E5E0DA] bg-white p-2 text-xs text-[#1A1A1A]"
          />
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium text-[#1A1A1A]" htmlFor="caption">
            Caption (Optional)
          </label>
          <input
            id="caption"
            type="text"
            maxLength={300}
            value={caption}
            disabled={uploading}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Master Bedroom, Marvela Villa Pune"
            className="mt-1 block w-full rounded border border-[#E5E0DA] bg-white p-2 text-xs text-[#1A1A1A]"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="submit"
            disabled={uploading || !selectedFile || !altText.trim()}
            className="rounded-md bg-[#1A1A1A] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#333333] disabled:opacity-50"
          >
            {uploading ? "Processing & Uploading..." : "Upload Image"}
          </button>

          <div aria-live="polite" className="text-xs">
            {uploadMessage && <span className="text-emerald-700 font-medium">{uploadMessage}</span>}
            {uploadError && <span className="text-red-600 font-medium">{uploadError}</span>}
          </div>
        </div>
      </form>

      {/* Media Grid */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Project Media ({mediaItems.length})</h3>

        {mediaItems.length === 0 ? (
          <p className="mt-3 text-xs text-stone-500 italic">No media items uploaded for this project yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {mediaItems.map((item, idx) => {
              const thumbUrl = item.public_object_path
                ? `${publicSupabaseUrl}/storage/v1/object/public/portfolio-public/${item.public_object_path.replace(
                    /(cover-1600|gallery-1200)\.webp$/,
                    "thumb-480.webp"
                  )}`
                : null;

              return (
                <div key={item.id} className="relative rounded-md border border-[#E5E0DA] bg-white p-3 shadow-xs">
                  {thumbUrl ? (
                    <div className="relative h-40 w-full overflow-hidden rounded bg-stone-100">
                      <Image
                        src={thumbUrl}
                        alt={item.alt_text}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded bg-amber-50 text-xs text-amber-800">
                      Draft Upload
                    </div>
                  )}

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1A1A1A] capitalize">{item.media_role}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          item.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-600 truncate" title={item.alt_text}>
                      {item.alt_text}
                    </p>

                    {item.width_px && item.height_px && (
                      <p className="text-[10px] text-stone-400">
                        {item.width_px}×{item.height_px}px | {Math.round((item.file_size_bytes || 0) / 1024)} KB
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[#F0ECE7] pt-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isPending || idx === 0}
                        onClick={() => handleReorder(item.id, "up")}
                        className="rounded border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-30"
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        disabled={isPending || idx === mediaItems.length - 1}
                        onClick={() => handleReorder(item.id, "down")}
                        className="rounded border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-30"
                      >
                        ↓ Down
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(item.id, item.media_role)}
                      className="rounded text-[10px] font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
