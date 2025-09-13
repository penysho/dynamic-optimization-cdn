"""Structured logging for S3 Object Lambda image processing."""

import json
import logging
import sys
from typing import Any


class StructuredLogger:
    """Structured logger for Lambda functions."""

    def __init__(self, name: str = __name__, level: str = "INFO"):
        """Initialize structured logger.

        Args:
            name: Logger name
            level: Log level
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper(), logging.INFO))

        # Remove existing handlers
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)

        # Add structured handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(self._create_formatter())
        self.logger.addHandler(handler)

        # Prevent duplicate logs
        self.logger.propagate = False

    def _create_formatter(self) -> logging.Formatter:
        """Create JSON formatter."""

        class JSONFormatter(logging.Formatter):
            def format(self, record):
                log_entry = {
                    "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
                    "level": record.levelname,
                    "message": record.getMessage(),
                    "logger": record.name,
                }

                # Add extra fields if present
                if hasattr(record, "extra_fields"):
                    log_entry.update(record.extra_fields)

                return json.dumps(log_entry)

        return JSONFormatter()

    def _log(
        self, level: int, message: str, extra_fields: dict[str, Any] | None = None
    ) -> None:
        """Log message with extra fields.

        Args:
            level: Log level
            message: Log message
            extra_fields: Additional fields to include
        """
        if extra_fields:
            self.logger.log(level, message, extra={"extra_fields": extra_fields})
        else:
            self.logger.log(level, message)

    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message."""
        self._log(logging.DEBUG, message, kwargs if kwargs else None)

    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message."""
        self._log(logging.INFO, message, kwargs if kwargs else None)

    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message."""
        self._log(logging.WARNING, message, kwargs if kwargs else None)

    def warn(self, message: str, **kwargs: Any) -> None:
        """Log warning message (alias)."""
        self.warning(message, **kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        """Log error message."""
        self._log(logging.ERROR, message, kwargs if kwargs else None)

    def critical(self, message: str, **kwargs: Any) -> None:
        """Log critical message."""
        self._log(logging.CRITICAL, message, kwargs if kwargs else None)


# Global logger instance
logger = StructuredLogger()


def get_logger(name: str = __name__, level: str = "INFO") -> StructuredLogger:
    """Get logger instance.

    Args:
        name: Logger name
        level: Log level

    Returns:
        StructuredLogger instance
    """
    return StructuredLogger(name, level)
