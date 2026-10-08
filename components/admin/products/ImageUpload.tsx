"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { s } from "./styles";

// Upload a product photo to /api/admin/upload (Vercel Blob). Uses XHR so the admin
// sees real upload progress on slow connections.

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  const upload = (file: File) => {
    setError("");
    if (!TYPES.includes(file.type)) return setError("Use a JPG, PNG, WebP or AVIF image.");
    if (file.size > MAX_BYTES) return setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);

    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      const res = (xhr.response ?? {}) as { url?: string; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && res.url) onUploaded(res.url);
      else setError(res.error ?? `Upload failed (${xhr.status}). Try again.`);
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Upload failed. Check your connection and try again.");
    };
    setProgress(0);
    xhr.send(body);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-stage/60 px-4 py-8 text-center transition-colors ${over ? s.dropActive : ""}`}
      >
        {progress === null ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink-2">
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 19.5h14" />
              </svg>
            </span>
            <p className="text-[14px] font-bold">Drop a photo here</p>
            <p className="text-[12px] text-muted">JPG, PNG, WebP or AVIF · up to 5 MB · square works best</p>
            <button type="button" onClick={() => input.current?.click()} className="btn btn-outline mt-1 min-h-9! px-5! py-2! text-[13px]!">
              Choose file
            </button>
          </>
        ) : (
          <div className="w-full max-w-xs" role="status" aria-live="polite">
            <p className="text-[13px] font-bold">Uploading… {progress}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a product photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-sale">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  );
}
