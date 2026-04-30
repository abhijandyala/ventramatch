"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";

/**
 * Founder pitch-deck uploader.
 *
 * Two paths in one widget:
 *
 *   1. Direct upload (preferred)
 *      Drag-drop or click → POSTs the PDF to /api/deck/upload (multipart).
 *      Shows a progress bar via XHR.upload.onprogress (fetch() can't observe
 *      upload progress yet). Stored privately in S3, served by the
 *      authed /api/deck/[startupId] route on view.
 *
 *   2. External link fallback
 *      For founders who'd rather host on DocSend / Drive / Notion, paste a
 *      URL. Saved to public.startups.deck_url via the existing wizard's
 *      onChange callback. Reads still work via the legacy code path.
 *
 * The two coexist: a profile may have BOTH set. The download route prefers
 * the in-bucket file when present.
 *
 * Props:
 *   - currentDeck: state from the parent (existing deck info).
 *   - urlValue / onUrlChange: the parent owns the external-URL field
 *     (it's part of the wizard's draft state and saves on Continue).
 *   - onUploaded: callback after a successful S3 upload so the parent
 *     can refresh its draft state.
 */

const MAX_BYTES = 25 * 1024 * 1024;

export type CurrentDeck = {
  filename: string | null;
  uploadedAt: string | null; // ISO
};

export function DeckUploader({
  currentDeck,
  urlValue,
  onUrlChange,
  onUploaded,
  disabled = false,
}: {
  currentDeck: CurrentDeck;
  urlValue: string;
  onUrlChange: (next: string) => void;
  onUploaded: (next: { filename: string; uploadedAt: string }) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasUploadedDeck = Boolean(currentDeck.filename);

  function reset() {
    setProgress(null);
    setError(null);
  }

  function uploadFile(file: File) {
    reset();

    if (file.type && file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is ${MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    if (file.size <= 0) {
      setError("File is empty.");
      return;
    }

    setBusy(true);
    setProgress(0);

    // We use XHR rather than fetch() because fetch can't report upload
    // progress yet (the streams API is partial across browsers).
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setError("Upload failed. Check your connection and try again.");
      setProgress(null);
    };
    xhr.onload = () => {
      setBusy(false);
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as {
            ok: boolean;
            filename?: string;
            uploadedAt?: string;
            error?: string;
          };
          if (json.ok && json.filename && json.uploadedAt) {
            onUploaded({ filename: json.filename, uploadedAt: json.uploadedAt });
            return;
          }
          setError(json.error ?? "Upload didn't return the expected payload.");
        } catch {
          setError("Server returned a malformed response.");
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText) as { error?: string };
          setError(json.error ?? `Upload failed (HTTP ${xhr.status}).`);
        } catch {
          setError(`Upload failed (HTTP ${xhr.status}).`);
        }
      }
    };

    xhr.open("POST", "/api/deck/upload");
    xhr.send(fd);
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // reset so picking the same file again triggers onChange
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !busy) fileInputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !busy) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={[
          "relative flex flex-col items-center justify-center rounded-[14px] border border-dashed p-7 text-center transition-colors",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-[color:var(--color-text-strong)]",
          dragOver
            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
            : "border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)]",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePicked}
          disabled={disabled || busy}
          className="sr-only"
        />

        {busy ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--color-text-muted)]" />
            <p className="mt-2 text-[13px] font-medium text-[color:var(--color-text-strong)]">
              Uploading… {progress != null ? `${progress}%` : ""}
            </p>
            {progress != null ? (
              <div className="mt-3 h-1 w-full max-w-[260px] overflow-hidden rounded-full bg-[color:var(--color-border)]">
                <div
                  className="h-full bg-[color:var(--color-brand)] transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
          </>
        ) : hasUploadedDeck ? (
          <>
            <FileText className="h-6 w-6 text-[color:var(--color-brand)]" />
            <p className="mt-2 text-[14px] font-medium text-[color:var(--color-text-strong)]">
              {currentDeck.filename}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[color:var(--color-text-faint)]">
              Uploaded {formatRelative(currentDeck.uploadedAt)} · click to replace
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-[color:var(--color-text-muted)]" />
            <p className="mt-2 text-[14px] font-medium text-[color:var(--color-text-strong)]">
              Drop your deck here, or click to browse
            </p>
            <p className="mt-0.5 text-[12px] text-[color:var(--color-text-faint)]">
              PDF only · up to 25 MB
            </p>
          </>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-[color:var(--color-danger,#dc2626)] bg-[color:var(--color-bg)] px-3 py-2 text-[12.5px] text-[color:var(--color-danger,#dc2626)]"
        >
          {error}
        </p>
      ) : null}

      {/* External-link fallback. Co-exists with the upload — useful for
          founders who insist on tracking opens via DocSend, etc. */}
      <div className="border-t border-[color:var(--color-border)] pt-5">
        <label className="block">
          <span className="mb-2 block text-[12px] font-medium text-[color:var(--color-text-strong)]">
            Or paste an external link (DocSend, Drive, Notion…)
          </span>
          <input
            type="url"
            value={urlValue}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://docsend.com/view/..."
            disabled={disabled}
            className="block h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 text-[14px] text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] transition-colors focus:border-[color:var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-faint)]">
          When both are set, your uploaded file takes priority for matched investors.
        </p>
      </div>

      {/* Remove button — only when there's something to remove */}
      {hasUploadedDeck && !busy ? (
        <RemoveButton onRemoved={() => onUploaded({ filename: "", uploadedAt: "" })} />
      ) : null}
    </div>
  );
}

/**
 * Remove the current uploaded deck. Two-step confirm (no destructive ops
 * on first click) and a single round-trip via DELETE /api/deck/upload.
 *
 * Note: we POST a "remove" form to /api/deck/upload right now — if you
 * want a true REST DELETE later, add that handler. For v1 the simpler
 * pattern is to issue a remove via the same route.
 */
function RemoveButton({ onRemoved }: { onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deck/upload", { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Remove failed (HTTP ${res.status}).`);
        return;
      }
      onRemoved();
      setConfirming(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--color-text-faint)] underline-offset-4 transition-colors hover:text-[color:var(--color-text-strong)] hover:underline"
      >
        <Trash2 size={11} aria-hidden /> Remove uploaded deck
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[color:var(--color-danger,#dc2626)] bg-[color:var(--color-bg)] px-3 py-2 text-[12px]">
      <span className="text-[color:var(--color-text-strong)]">Remove your uploaded deck?</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 font-medium text-[color:var(--color-danger,#dc2626)] underline-offset-4 hover:underline disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Confirm remove
      </button>
      {error ? <span className="text-[color:var(--color-danger,#dc2626)]">{error}</span> : null}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
