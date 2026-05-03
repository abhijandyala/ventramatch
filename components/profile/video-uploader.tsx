"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Trash2, UploadCloud } from "lucide-react";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const ACCEPTED = "video/mp4,video/webm,video/quicktime";

export type CurrentVideo = {
  filename: string | null;
  uploadedAt: string | null;
};

export function VideoUploader({
  currentVideo,
  onUploaded,
  disabled = false,
}: {
  currentVideo: CurrentVideo;
  onUploaded: (next: { filename: string; uploadedAt: string } | { filename: null; uploadedAt: null }) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasVideo = Boolean(currentVideo.filename);

  function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError("File too large (max 100 MB).");
      return;
    }
    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, WebM, or MOV).");
      return;
    }
    setError(null);
    setBusy(true);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setBusy(false);
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          onUploaded({ filename: res.filename ?? file.name, uploadedAt: new Date().toISOString() });
        } catch {
          onUploaded({ filename: file.name, uploadedAt: new Date().toISOString() });
        }
      } else {
        setError("Upload failed. Please try again.");
      }
    });
    xhr.addEventListener("error", () => {
      setBusy(false);
      setProgress(null);
      setError("Network error during upload.");
    });

    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", "/api/video/upload");
    xhr.send(form);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDelete() {
    onUploaded({ filename: null, uploadedAt: null });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-[color:var(--color-text-muted)]" strokeWidth={1.75} />
        <span className="text-[13px] font-medium text-[color:var(--color-text)]">
          Product video
        </span>
        <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-text-faint)]">
          Optional
        </span>
      </div>

      {hasVideo ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white p-4">
          <Film className="h-5 w-5 shrink-0 text-[color:var(--color-brand)]" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[color:var(--color-text)]">
              {currentVideo.filename}
            </p>
            {currentVideo.uploadedAt && (
              <p className="text-[11px] text-[color:var(--color-text-faint)]">
                Uploaded {new Date(currentVideo.uploadedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[color:var(--color-text-faint)] transition-colors hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && !busy && fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={[
            "flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragOver
              ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
              : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-faint)]",
            disabled || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          ].join(" ")}
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--color-brand)]" strokeWidth={1.75} />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                Uploading{progress != null ? ` (${progress}%)` : "..."}
              </p>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-[color:var(--color-text-faint)]" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                Drag & drop or click to upload
              </p>
              <p className="text-[11px] text-[color:var(--color-text-faint)]">
                MP4, WebM, or MOV · Max 100 MB
              </p>
            </>
          )}
        </div>
      )}

      {progress != null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-border)]">
          <div
            className="h-full bg-[color:var(--color-brand)] transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-[12px] text-[color:var(--color-danger)]">{error}</p>
      )}

      <p className="text-[12px] leading-[1.5] text-[color:var(--color-text-faint)]">
        Profiles with a video get significantly more investor clicks. This plays when someone hovers on your card in the feed.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
