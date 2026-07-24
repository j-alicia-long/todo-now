// Transport: the narrow seam between client stores and the HTTP API.
// Stores talk to this interface only, so tests can swap in an in-memory
// implementation without touching fetch.

export type Transport = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
  del: (path: string) => Promise<void>;
};

const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const ensureOk = (res: Response, method: string, path: string) => {
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status}`);
  }
};

export const httpTransport: Transport = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    ensureOk(res, "GET", path);
    return res.json();
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
    ensureOk(res, "POST", path);
    return res.json();
  },
  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
    ensureOk(res, "PUT", path);
    return res.json();
  },
  del: async (path: string): Promise<void> => {
    const res = await fetch(path, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    ensureOk(res, "DELETE", path);
  },
};
