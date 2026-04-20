import { apiClient } from "./client";
import type { AuthResponse, UserProfile, Workspace } from "./types";

type AuthPayload = {
  email: string;
  password: string;
};

export async function login(payload: AuthPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function register(payload: AuthPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", payload);
  return data;
}

export async function me(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>("/auth/me");
  return data;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<Workspace[]>("/workspaces");
  return data;
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const { data } = await apiClient.post<Workspace>("/workspaces", { name });
  return data;
}
