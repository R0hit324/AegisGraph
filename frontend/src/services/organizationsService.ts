/**
 * Organization, scope, membership and audit services.
 * All authorization happens server-side (owner/admin/analyst/viewer);
 * the frontend merely hides affordances the role does not grant.
 */

import { request } from "@/services/apiClient";
import type {
  AuditEntry,
  Organization,
  OrganizationMember,
  OrganizationRole,
  Scope,
  ScopePayload,
} from "@/types/api";

/* ------------------------------------------------------------- organizations */

export function listOrganizations(): Promise<Organization[]> {
  return request<Organization[]>("/organizations");
}

export function createOrganization(input: {
  name: string;
  description?: string;
}): Promise<Organization> {
  return request<Organization>("/organizations", {
    method: "POST",
    body: { name: input.name, description: input.description ?? null },
  });
}

/* -------------------------------------------------------------------- scopes */

export function listScopes(orgId: number): Promise<Scope[]> {
  return request<Scope[]>(`/organizations/${orgId}/scopes`);
}

export function createScope(orgId: number, payload: ScopePayload): Promise<Scope> {
  return request<Scope>(`/organizations/${orgId}/scopes`, {
    method: "POST",
    body: payload,
  });
}

export function updateScope(
  orgId: number,
  scopeId: number,
  patch: Partial<ScopePayload> & { is_active?: boolean },
): Promise<Scope> {
  return request<Scope>(`/organizations/${orgId}/scopes/${scopeId}`, {
    method: "PUT",
    body: patch,
  });
}

/** Scopes are soft-deleted server-side (`is_active` flips to false). */
export function deleteScope(orgId: number, scopeId: number): Promise<undefined> {
  return request<undefined>(`/organizations/${orgId}/scopes/${scopeId}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ members */

export function listMembers(orgId: number): Promise<OrganizationMember[]> {
  return request<OrganizationMember[]>(`/organizations/${orgId}/members`);
}

export function addMember(
  orgId: number,
  userId: number,
  role: OrganizationRole,
): Promise<OrganizationMember> {
  return request<OrganizationMember>(`/organizations/${orgId}/members`, {
    method: "POST",
    body: { user_id: userId, role },
  });
}

export function removeMember(orgId: number, userId: number): Promise<undefined> {
  return request<undefined>(`/organizations/${orgId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function assignRole(
  orgId: number,
  userId: number,
  role: OrganizationRole,
): Promise<{ id: number; name: string }> {
  return request<{ id: number; name: string }>(
    `/organizations/${orgId}/roles/assign?user_id=${userId}&role_name=${encodeURIComponent(role)}`,
    { method: "POST" },
  );
}

/* --------------------------------------------------------------------- audit */

export function listAuditEntries(orgId: number, limit = 50): Promise<AuditEntry[]> {
  return request<AuditEntry[]>(`/organizations/${orgId}/audit?limit=${limit}`);
}
