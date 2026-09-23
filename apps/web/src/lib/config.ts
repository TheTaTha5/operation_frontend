const valueOrDefault = (value: string | undefined, fallback: string): string =>
  value?.trim() || fallback;

export const config = {
  legacyUrl: valueOrDefault(import.meta.env.VITE_LEGACY_URL, "/allotment_v2/allotment_v2.html"),
  environment: valueOrDefault(import.meta.env.VITE_APP_ENV, "local"),
} as const;
