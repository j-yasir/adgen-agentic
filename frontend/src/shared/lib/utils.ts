import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

/**
 * Convert a backend storage_url (local filesystem path) to a browser-fetchable URL.
 * Handles two asset trees:
 *   business_assets/ → /business-assets/  (logos, product photos)
 *   generations/     → /generations/      (pipeline-generated ads, images)
 */
export function toAssetUrl(storageUrl: string | null | undefined): string | null {
  if (!storageUrl) return null;
  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) return storageUrl;
  if (/^business_assets[\\/]/.test(storageUrl)) {
    return "/business-assets/" + storageUrl.replace(/^business_assets[\\/]/, "").replace(/\\/g, "/");
  }
  if (/^generations[\\/]/.test(storageUrl)) {
    return "/generations/" + storageUrl.replace(/^generations[\\/]/, "").replace(/\\/g, "/");
  }
  return null;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}
