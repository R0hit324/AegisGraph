"""Structured (JSON) application logging.

Rules enforced here:
- Logs go to stdout as single-line JSON objects (container friendly).
- Secret-bearing configuration values are NEVER passed to log calls; the
  formatter additionally scrubs obvious credential fields.
- Formatter failures never break the running application (defensive `str` used
  for values; format failure falls back to a minimal record).
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

# Field names that must never be written to logs even if a caller accidentally
# passes them as extra data.
SCRUBBED_KEYS = frozenset(
    {
        "password",
        "secret",
        "secret_key",
        "database_url",
        "api_key",
        "api_secret",
        "token",
        "authorization",
        "cookie",
    }
)

_RESERVED_ATTRS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "stacklevel",
        "stderr",
        "stdout",
        "taskName",
        "thread",
        "threadName",
        "markup",
        "extra",
    }
)


class JsonFormatter(logging.Formatter):
    """Render a LogRecord as one JSON line, scrubbing sensitive keys."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(
                timespec="milliseconds"
            ),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED_ATTRS
            and key
            not in {
                "levelname",
                "levelno",
                "created",
                "msecs",
                "relativeCreated",
                "taskName",
                "exc_text",
            }
        }
        for key, value in extras.items():
            if key.lower() in SCRUBBED_KEYS or "password" in key.lower():
                payload[key] = "[REDACTED]"
            else:
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        try:
            return json.dumps(payload, default=str, ensure_ascii=False)
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return json.dumps({"message": "unserializable log record", "level": record.levelname})


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON logging configuration for the application."""
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Third-party loggers stay quiet in normal operation.
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("uvicorn").handlers = [handler]
    logging.getLogger("uvicorn.error").handlers = [handler]
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced project logger bound to root (JSON) config."""
    return logging.getLogger(f"app.{name}")
