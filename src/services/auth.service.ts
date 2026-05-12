import { api } from "./api";
import type { LoginInput } from "../schemas";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function loginRequest(
  credentials: LoginInput,
): Promise<LoginResponse> {
  return api.post<LoginResponse>("/auth/login", credentials);
}

export async function meRequest(): Promise<AuthUser & { id: string }> {
  return api.get("/auth/me");
}

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return api.post("/auth/change-password", { currentPassword, newPassword });
}
