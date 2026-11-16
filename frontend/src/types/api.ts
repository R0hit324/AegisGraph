/** Shared API types mirroring backend Pydantic response (app/schemas/health.py). */

export type BackendStatus = "ok" | "degraded";
export type DatabaseStatus = "connected" | "unavailable";

export interface HealthResponse {
  status: BackendStatus;
  application: string;
  version: string;
  environment: string;
  database: DatabaseStatus;
  timestamp: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

/* ------------------------------------------------------------------ */
/* Phase 2: authentication, organizations, scopes and audit            */
/* ------------------------------------------------------------------ */

/** Mirrors backend `UserResponse` (app/schemas/user.py). */
export interface SessionUser {
  id: number;
  username: string;
  email: string | null;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export type OrganizationRole = "owner" | "admin" | "analyst" | "viewer";

/** Mirrors backend `OrganizationResponse` (app/schemas/organization.py). */
export interface Organization {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors backend `ScopeResponse`. */
export interface Scope {
  id: number;
  name: string;
  description: string | null;
  domain_pattern: string;
  is_active: boolean;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

/** Mirrors backend `OrganizationMemberResponse`. */
export interface OrganizationMember {
  user_id: number;
  username: string;
  role: OrganizationRole;
  joined_at: string;
}

/**
 * Mirrors backend `AuditLogEntry` (app/schemas/audit.py). By design this
 * carries no IP addresses, user agents, tokens or password material.
 */
export interface AuditEntry {
  id: number;
  action: string;
  outcome: "success" | "failure";
  created_at: string;
  actor_username: string | null;
  organization_name: string | null;
}

export type ScopePayload = {
  name: string;
  domain_pattern: string;
  description?: string;
  is_active?: boolean;
};
