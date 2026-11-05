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
