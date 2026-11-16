/**
 * Session service.
 *
 * The access token NEVER touches JavaScript: registration, login, refresh and
 * logout all rely on the backend's HttpOnly `aegis_access_token` cookie. Only
 * the session profile (from `GET /auth/me`) is read into memory.
 */

import { request } from "@/services/apiClient";
import type { SessionUser } from "@/types/api";

/** Read the current session profile. 401 means "not signed in". */
export function getSession(): Promise<SessionUser> {
  return request<SessionUser>("/auth/me");
}

/**
 * Sign in with the OAuth2 form contract the backend expects
 * (`POST /auth/login`, x-www-form-urlencoded).
 */
export async function login(username: string, password: string): Promise<SessionUser> {
  await request<unknown>("/auth/login", {
    method: "POST",
    bodyText: new URLSearchParams({ username, password }).toString(),
  });
  return getSession();
}

/** Create an account; the backend signs the user in via cookie. */
export async function register(input: {
  username: string;
  email?: string;
  password: string;
}): Promise<SessionUser> {
  await request<unknown>("/auth/register", {
    method: "POST",
    body: { username: input.username, email: input.email ?? null, password: input.password },
  });
  return getSession();
}

/** Clear the session cookie server-side. */
export function logout(): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/logout", { method: "POST" });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/change-password", {
    method: "POST",
    body: { current_password: input.currentPassword, new_password: input.newPassword },
  });
}
