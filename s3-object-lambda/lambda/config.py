"""Configuration management for S3 Object Lambda image processing.

Handles environment variables and application settings.
"""

import os


class Config:
    """Application configuration class."""

    def __init__(self, env: dict | None = None):
        """Initialize configuration with environment variables.

        Args:
            env: Environment variables dict (defaults to os.environ)
        """
        self._env = env or os.environ

    @property
    def aws_region(self) -> str:
        """Get AWS region."""
        return self._env.get(
            "AWS_REGION", self._env.get("AWS_DEFAULT_REGION", "us-east-1")
        )

    @property
    def is_signature_enabled(self) -> bool:
        """Check if signature validation is enabled."""
        return self._env.get("ENABLE_SIGNATURE", "false").lower() == "true"

    @property
    def secret_name(self) -> str | None:
        """Get secret name for signature validation."""
        return self._env.get("SECRET_NAME") or None

    @property
    def image_bucket(self) -> str | None:
        """Get configured image bucket name."""
        return self._env.get("IMAGE_BUCKET") or None

    @property
    def is_smart_crop_enabled(self) -> bool:
        """Check if smart crop is enabled."""
        return self._env.get("ENABLE_SMART_CROP", "false").lower() == "true"

    @property
    def is_content_moderation_enabled(self) -> bool:
        """Check if content moderation is enabled."""
        return self._env.get("ENABLE_CONTENT_MODERATION", "false").lower() == "true"

    @property
    def is_auto_webp_enabled(self) -> bool:
        """Check if auto WebP conversion is enabled."""
        return self._env.get("AUTO_WEBP", "false").lower() == "true"

    @property
    def is_default_fallback_image_enabled(self) -> bool:
        """Check if default fallback image is enabled."""
        return self._env.get("ENABLE_DEFAULT_FALLBACK_IMAGE", "false").lower() == "true"

    @property
    def fallback_image_s3_bucket(self) -> str | None:
        """Get fallback image S3 bucket name."""
        return self._env.get("FALLBACK_IMAGE_S3_BUCKET") or None

    @property
    def fallback_image_s3_key(self) -> str | None:
        """Get fallback image S3 key."""
        return self._env.get("FALLBACK_IMAGE_S3_KEY") or None

    @property
    def is_cors_enabled(self) -> bool:
        """Check if CORS is enabled."""
        return self._env.get("CORS_ENABLED", "false").lower() == "true"

    @property
    def cors_origin(self) -> str:
        """Get CORS origin."""
        return self._env.get("CORS_ORIGIN", "*")

    @property
    def log_level(self) -> str:
        """Get log level."""
        level = self._env.get("LOG_LEVEL", "INFO").upper()
        return (
            level
            if level in ["DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL"]
            else "INFO"
        )

    def validate(self) -> None:
        """Validate configuration.

        Raises:
            ValueError: If configuration is invalid
        """
        if self.is_signature_enabled and not self.secret_name:
            raise ValueError("SECRET_NAME must be set when ENABLE_SIGNATURE is true")

        if (
            self.is_smart_crop_enabled or self.is_content_moderation_enabled
        ) and not self.aws_region:
            raise ValueError("AWS_REGION must be set when using Rekognition services")

        if self.is_default_fallback_image_enabled:
            if not self.fallback_image_s3_bucket:
                raise ValueError(
                    "FALLBACK_IMAGE_S3_BUCKET must be set when ENABLE_DEFAULT_FALLBACK_IMAGE is true"
                )
            if not self.fallback_image_s3_key:
                raise ValueError(
                    "FALLBACK_IMAGE_S3_KEY must be set when ENABLE_DEFAULT_FALLBACK_IMAGE is true"
                )
