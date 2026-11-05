/** Health endpoint access — the single call site for backend connectivity. */

import { request } from "@/services/apiClient";
import type { HealthResponse } from "@/types/api";

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/v1/health");
}
