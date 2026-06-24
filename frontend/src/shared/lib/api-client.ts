type TokenStore = {
  accessToken: string | null;
  refreshToken: string | null;
};

const tokens: TokenStore = {
  accessToken: null,
  refreshToken: null,
};

export function getAccessToken() {
  return tokens.accessToken;
}

export function setTokens(access: string, refresh: string) {
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
}

export function clearTokens() {
  tokens.accessToken = null;
  tokens.refreshToken = null;
}

export function getRefreshToken() {
  return tokens.refreshToken;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public detail?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refreshToken;
  if (!refresh) return false;

  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokens.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(`/api/v1${endpoint}`, { ...options, headers });

  if (res.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${tokens.accessToken}`;
      res = await fetch(`/api/v1${endpoint}`, { ...options, headers });
    }
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.error || "UNKNOWN",
      body.message || "Request failed",
      body.detail
    );
  }

  return body as T;
}

export { ApiError };
