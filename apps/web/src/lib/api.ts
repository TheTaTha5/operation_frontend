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
 * Send JSON to a same-origin endpoint. On failure the ApiError message is the server's own text, so
 * a form can show it as-is. operation-backend (Fastify) puts that text in `message` and only the
 * status name ("Conflict") in `error`; server.js puts it in `error`.
 */
export async function sendJson<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.message || data?.error || `${method} ${path} failed with ${res.status}`);
  return data as T;
}

export const postJson = <T>(path: string, body: unknown): Promise<T> => sendJson<T>("POST", path, body);
export const patchJson = <T>(path: string, body: unknown): Promise<T> => sendJson<T>("PATCH", path, body);
