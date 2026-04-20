import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";

let authToken: string | null = null;
let workspaceId: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  const headers = config.headers;
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  if (workspaceId) {
    headers.set("X-Workspace-Id", workspaceId);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setWorkspaceId(id: string | null): void {
  workspaceId = id;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}
