export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** GET a JSON endpoint on the same origin; the `sess` cookie rides along. */
export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

/**
 * POST JSON to a same-origin endpoint. On failure the ApiError message is the server's `error`
 * text when it sent one, so a form can show it as-is.
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error || `POST ${path} failed with ${res.status}`);
  return data as T;
}
