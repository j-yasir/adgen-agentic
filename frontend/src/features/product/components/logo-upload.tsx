"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import { useUploadLogo, useDeleteLogo } from "../hooks/use-logo";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

interface LogoUploadProps {
  businessId: string;
  logoUrl: string | null | undefined;
  initials: string;
}

export function LogoUpload({ businessId, logoUrl, initials }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const logoSrc = toAssetUrl(logoUrl);

  const upload = useUploadLogo(businessId);
  const remove = useDeleteLogo(businessId);

  const isPending = upload.isPending || remove.isPending;

  function openPicker() {
    if (isPending) return;
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected after removal
    e.target.value = "";

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Only PNG, JPG, and WebP images are supported");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }

    try {
      await upload.mutateAsync(file);
      toast.success("Logo updated");
    } catch {
      toast.error("Failed to upload logo");
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await remove.mutateAsync();
      toast.success("Logo removed");
    } catch {
      toast.error("Failed to remove logo");
    }
  }

  return (
    <div className="relative shrink-0">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={handleFile}
      />

      {/* Logo area — clickable */}
      <button
        type="button"
        onClick={openPicker}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={isPending}
        className={cn(
          "relative h-16 w-16 rounded-2xl overflow-hidden border-2 transition-all duration-200",
          logoSrc
            ? "border-slate-200"
            : "border-dashed border-slate-200 bg-slate-50"
        )}
        title={logoSrc ? "Replace logo" : "Upload logo"}
      >
        {/* Logo image or initials */}
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt="Business logo"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-2xl font-bold text-slate-300 select-none">
            {initials}
          </span>
        )}

        {/* Hover / loading overlay */}
        {(hovering || isPending) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/40">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <>
                <Camera className="h-4 w-4 text-white" />
                <span className="text-[9px] font-semibold text-white uppercase tracking-wide">
                  {logoSrc ? "Replace" : "Upload"}
                </span>
              </>
            )}
          </div>
        )}
      </button>

      {/* Remove button — only when logo exists */}
      {logoSrc && !isPending && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors"
          title="Remove logo"
        >
          <X className="h-3 w-3 text-slate-400 hover:text-red-500 transition-colors" />
        </button>
      )}
    </div>
  );
}
