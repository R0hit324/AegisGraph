/**
 * Calm, specific text for authentication errors.
 * The backend never receives or echoes passwords; messages here only reflect
 * HTTP status and verified server detail — never credential content.
 */

import { ApiError } from "@/services/apiClient";

export const BACKEND_UNREACHABLE = "Could not reach the backend at localhost:8000. Confirm it is running, then try again.";

export function describeAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return BACKEND_UNREACHABLE;
      case "timeout":
        return "The backend did not respond in time. Try again.";
      case "parse":
        return "The backend sent an unexpected response.";
      case "http":
        switch (error.status) {
          case 401:
            return "That username and password combination is not recognized.";
          case 429:
            return "Too many attempts from this network. Wait a minute, then try again.";
          default: {
            const generic = `The API responded with HTTP ${error.status}.`;
            if (error.message && error.message !== generic) {
              return error.message;
            }
            return "The request could not be completed. Try again.";
          }
        }
    }
  }
  return "An unexpected error occurred. Try again.";
}
