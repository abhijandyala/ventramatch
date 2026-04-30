"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { Avatar, type AvatarSize } from "./avatar";

/**
 * Avatar upload + crop component.
 *
 * Flow:
 *   1. User picks/drops an image file (jpg/png/webp).
 *   2. We open a modal with react-easy-crop showing a circular crop frame.
 *   3. On Confirm we draw the crop to a 512×512 canvas, export as JPEG
 *      (q=0.85), and POST the resulting bytes to /api/avatar/upload.
 *   4. On success we call onUpdated with the new URL so the parent can
 *      re-render its preview avatar without a router refresh.
 *
 * Why client-side resize:
 *   - No server image library (sharp) needed → no native binding to
 *     manage on Railway.
 *   - Smaller upload payloads → faster, cheaper bandwidth.
 *   - Same UX pattern as Twitter / GitHub.
 */

const MAX_INPUT_BYTES = 8 * 1024 * 1024; // raw upload before crop
const OUTPUT_PX = 512;
const OUTPUT_QUALITY = 0.85;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function AvatarUploader({
  userId,
  name,
  currentSrc,
  onUpdated,
  size = "lg",
  disabled = false,
}: {
  userId: string;
  name: string | null;
  /** Currently-displayed src (resolved upstream). */
  currentSrc: string | null;
  /** Called after a successful upload OR remove. null src means removed. */
  onUpdated: (next: { src: string | null; updatedAt: string | null }) => void;
  size?: AvatarSize;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCropArea(areaPixels);
  }, []);

  function reset() {
    setImageDataUrl(null);
    setCropArea(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
  }

  function pickFile(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError(`Pick something under ${MAX_INPUT_BYTES / 1024 / 1024} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result);
      }
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  }

  function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  async function confirmCrop() {
    if (!imageDataUrl || !cropArea) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await renderCropToJpeg(imageDataUrl, cropArea, OUTPUT_PX, OUTPUT_QUALITY);
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/avatar/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string | null;
        updatedAt?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Upload failed (HTTP ${res.status}).`);
        return;
      }
      onUpdated({
        src: json.url ?? null,
        updatedAt: json.updatedAt ?? new Date().toISOString(),
      });
      reset();
    } catch (err) {
      console.error("[avatar-uploader] crop/upload failed", err);
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/avatar/upload", { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Remove failed (HTTP ${res.status}).`);
        return;
      }
      onUpdated({ src: null, updatedAt: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Current avatar preview */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="shrink-0"
      >
        <Avatar id={userId} name={name} src={currentSrc} size={size} />
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPicked}
          disabled={disabled || busy}
          className="sr-only"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-medium transition-colors hover:bg-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-strong)",
            }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud size={13} />
            )}
            {currentSrc ? "Replace photo" : "Upload photo"}
          </button>
          {currentSrc ? (
            <button
              type="button"
              onClick={removeAvatar}
              disabled={disabled || busy}
              className="inline-flex h-9 items-center gap-1.5 px-2 text-[12px] font-medium text-[color:var(--color-text-faint)] underline-offset-4 transition-colors hover:text-[color:var(--color-text-strong)] hover:underline disabled:opacity-60"
            >
              <Trash2 size={11} aria-hidden /> Remove
            </button>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-faint)]">
          JPEG, PNG, or WebP · up to {MAX_INPUT_BYTES / 1024 / 1024} MB · cropped to a circle
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-2 text-[12px] text-[color:var(--color-danger,#dc2626)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Crop modal */}
      {imageDataUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) reset();
          }}
        >
          <div
            className="flex w-full max-w-[480px] flex-col gap-4 rounded-[14px] border bg-[color:var(--color-bg)] p-5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <header>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
                Crop your avatar
              </p>
              <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
                Drag to position, scroll or pinch to zoom. We&apos;ll export it at 512×512.
              </p>
            </header>

            <div className="relative h-[300px] w-full overflow-hidden rounded-[10px] bg-black">
              <Cropper
                image={imageDataUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[color:var(--color-brand)]"
            />

            <div className="flex items-center justify-end gap-2 border-t border-[color:var(--color-border)] pt-3">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="inline-flex h-9 items-center px-3 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCrop}
                disabled={busy || !cropArea}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[color:var(--color-brand)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Draw the cropped region of `imageSrc` to a square canvas of `targetPx`
 * pixels and return a JPEG Blob. Pure browser API — no library beyond
 * what's built in.
 */
async function renderCropToJpeg(
  imageSrc: string,
  area: Area,
  targetPx: number,
  quality: number,
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = targetPx;
  canvas.height = targetPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    targetPx,
    targetPx,
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
