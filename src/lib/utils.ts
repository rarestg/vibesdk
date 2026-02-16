import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPreviewUrl(previewURL?: string, tunnelURL?: string): string {
  const previewMode = import.meta.env.VITE_PREVIEW_MODE;

  if (previewMode === 'tunnel') {
    return tunnelURL || previewURL || '';
  }

  if (previewMode === 'preview') {
    return previewURL || tunnelURL || '';
  }

  // In local development, tunnel URLs are typically reachable without custom DNS setup.
  if (import.meta.env.DEV) {
    return tunnelURL || previewURL || '';
  }

  return previewURL || tunnelURL || '';
}

export function capitalizeFirstLetter(str: string) {
  if (typeof str !== 'string' || str.length === 0) {
    return str; // Handle non-string input or empty string
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}
