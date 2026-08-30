"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import {
  useUploadProductImage,
  useDeleteProductImage,
  useSetPrimaryImage,
} from "../hooks/use-product-images";
import type { ProductImageResponse } from "../types";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_IMAGES = 8;

interface ProductImageManagerProps {
  businessId: string;
  productId: string;
  images: ProductImageResponse[];
}

export function ProductImageManager({
  businessId,
  productId,
  images,
}: ProductImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const uploadMut = useUploadProductImage(businessId, productId);
  const deleteMut = useDeleteProductImage(businessId, productId);
  const primaryMut = useSetPrimaryImage(businessId, productId);

  const canAdd = images.length < MAX_IMAGES;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Only PNG, JPG, and WebP images are supported");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 12 MB");
      return;
    }

    try {
      await uploadMut.mutateAsync(file);
      toast.success("Image uploaded");
    } catch {
      toast.error("Failed to upload image");
    }
  }

  async function handleDelete(imageId: string) {
    try {
      await deleteMut.mutateAsync(imageId);
      toast.success("Image removed");
    } catch {
      toast.error("Failed to remove image");
    }
  }

  async function handleSetPrimary(imageId: string) {
    try {
      await primaryMut.mutateAsync(imageId);
      toast.success("Primary image updated");
    } catch {
      toast.error("Failed to set primary image");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Product Images
        </span>
        <span className="text-xs text-slate-400">
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={handleFile}
      />

      <div className="flex flex-wrap gap-2">
        {/* Existing images */}
        {images.map((img) => (
          <div
            key={img.id}
            className={cn(
              "group relative h-20 w-20 rounded-xl overflow-hidden border-2 transition-all",
              img.is_primary
                ? "border-indigo-400 ring-1 ring-indigo-300"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={toAssetUrl(img.storage_url) ?? ""}
              alt="Product image"
              className="h-full w-full object-cover cursor-pointer"
              onClick={() => setPreview(toAssetUrl(img.storage_url))}
            />

            {/* Primary star badge */}
            {img.is_primary && (
              <div className="absolute top-1 left-1 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center">
                <Star className="h-2.5 w-2.5 text-white fill-white" />
              </div>
            )}

            {/* Actions overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              {!img.is_primary && (
                <button
                  type="button"
                  onClick={() => handleSetPrimary(img.id)}
                  disabled={primaryMut.isPending}
                  className="h-6 w-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                  title="Set as primary"
                >
                  {primaryMut.isPending && primaryMut.variables === img.id ? (
                    <Loader2 className="h-3 w-3 text-white animate-spin" />
                  ) : (
                    <Star className="h-3 w-3 text-white" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                disabled={deleteMut.isPending}
                className="h-6 w-6 rounded-full bg-white/20 hover:bg-red-500/70 flex items-center justify-center transition-colors"
                title="Delete image"
              >
                {deleteMut.isPending && deleteMut.variables === img.id ? (
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3 text-white" />
                )}
              </button>
            </div>
          </div>
        ))}

        {/* Add button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMut.isPending}
            className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all flex flex-col items-center justify-center gap-1"
          >
            {uploadMut.isPending ? (
              <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5 text-slate-400" />
                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">
                  Add
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        First image or starred one is used by the pipeline as primary.
      </p>

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="max-h-[80vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
