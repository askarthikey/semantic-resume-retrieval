import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20000,
});

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
