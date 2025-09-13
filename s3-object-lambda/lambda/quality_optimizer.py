"""Quality optimization utilities for S3 Object Lambda image processing.

Provides optimized quality settings based on format, use case, and best practices.
"""

from enum import Enum
from typing import ClassVar

from models import TransformParams


class QualityProfile(Enum):
    """Quality profile enumeration for different use cases."""

    HIGH = "high"  # For photos, artwork, detailed images
    STANDARD = "standard"  # General purpose, balanced quality/size
    OPTIMIZED = "optimized"  # Fast delivery, bandwidth conscious


class QualityOptimizer:
    """Quality optimization manager with format-specific settings."""

    # Constants for dynamic quality adjustment
    HIGH_QUALITY_THRESHOLD = 90
    SMALL_THUMBNAIL_SIZE = 300
    LARGE_IMAGE_SIZE = 1200

    # Format-specific quality settings based on research and best practices
    QUALITY_SETTINGS: ClassVar[dict[QualityProfile, dict[str, int]]] = {
        QualityProfile.HIGH: {
            "jpeg": 90,  # High quality for photos
            "webp": 85,  # Excellent WebP quality
            "avif": 70,  # AVIF delivers great quality at lower values
        },
        QualityProfile.STANDARD: {
            "jpeg": 85,  # Google PageSpeed recommended
            "webp": 80,  # Good balance for WebP
            "avif": 60,  # Standard AVIF quality
        },
        QualityProfile.OPTIMIZED: {
            "jpeg": 75,  # Fast delivery focused
            "webp": 70,  # Size optimized WebP
            "avif": 50,  # Efficient AVIF compression
        },
    }

    # PNG compression levels (0-9, where 9 is maximum compression)
    PNG_COMPRESSION_LEVELS: ClassVar[dict[QualityProfile, int]] = {
        QualityProfile.HIGH: 6,  # Balanced for high quality
        QualityProfile.STANDARD: 6,  # Standard compression
        QualityProfile.OPTIMIZED: 9,  # Maximum compression for size
    }

    def __init__(self, default_profile: QualityProfile = QualityProfile.STANDARD):
        """Initialize quality optimizer.

        Args:
            default_profile: Default quality profile to use
        """
        self.default_profile = default_profile

    def get_optimal_quality(
        self,
        image_format: str,
        quality_profile: QualityProfile | None = None,
        custom_quality: int | None = None,
        file_size_hint: int | None = None,
    ) -> int:
        """Get optimal quality setting for given parameters.

        Args:
            image_format: Image format (jpeg, webp, avif, png)
            quality_profile: Quality profile to use
            custom_quality: Override with custom quality value
            file_size_hint: Original file size for dynamic adjustment

        Returns:
            Optimal quality setting
        """
        # Use custom quality if provided
        if custom_quality is not None:
            return self._validate_quality(custom_quality)

        # Normalize format
        normalized_format = self._normalize_format(image_format)

        # Use provided profile or default
        profile = quality_profile or self.default_profile

        # Handle PNG separately (uses compression level, not quality)
        if normalized_format == "png":
            return self.PNG_COMPRESSION_LEVELS[profile]

        # Get base quality for format and profile
        base_quality = self.QUALITY_SETTINGS[profile].get(normalized_format, 85)

        # Apply dynamic adjustment based on file size if available
        if file_size_hint is not None:
            base_quality = self._apply_dynamic_adjustment(
                base_quality, file_size_hint, normalized_format
            )

        return self._validate_quality(base_quality)

    def get_save_arguments(
        self,
        image_format: str,
        quality_profile: QualityProfile | None = None,
        custom_quality: int | None = None,
        file_size_hint: int | None = None,
    ) -> dict[str, any]:
        """Get optimized save arguments for PIL Image.save().

        Args:
            image_format: Image format (jpeg, webp, avif, png)
            quality_profile: Quality profile to use
            custom_quality: Override with custom quality value
            file_size_hint: Original file size for dynamic adjustment

        Returns:
            Dictionary of save arguments for PIL
        """
        normalized_format = self._normalize_format(image_format)
        quality = self.get_optimal_quality(
            normalized_format, quality_profile, custom_quality, file_size_hint
        )

        base_args = {
            "format": normalized_format.upper(),
            "optimize": True,
        }

        if normalized_format in ("jpeg", "webp", "avif"):
            base_args["quality"] = quality
        elif normalized_format == "png":
            base_args["compress_level"] = quality

        # Format-specific optimizations
        if normalized_format == "jpeg":
            base_args.update(
                {
                    "progressive": True,  # Progressive JPEG for better perceived loading
                    "subsampling": 0,  # Better quality chroma subsampling
                }
            )
        elif normalized_format == "webp":
            base_args.update(
                {
                    "method": 6,  # Better compression method
                    "lossless": False,  # Use lossy compression for smaller size
                }
            )
        elif normalized_format == "png":
            base_args.update(
                {
                    "optimize": True,  # Optimize PNG palette and chunks
                }
            )

        return base_args

    def determine_quality_profile_from_params(
        self, params: TransformParams
    ) -> QualityProfile:
        """Determine appropriate quality profile based on transformation parameters.

        Args:
            params: Transformation parameters

        Returns:
            Recommended quality profile
        """
        # Check for high-quality indicators
        if params.get("quality", 0) >= self.HIGH_QUALITY_THRESHOLD:
            return QualityProfile.HIGH

        # Check for size optimization indicators
        width = params.get("width", 0)
        height = params.get("height", 0)

        # Small thumbnails can use optimized profile
        if (width and width <= self.SMALL_THUMBNAIL_SIZE) or (
            height and height <= self.SMALL_THUMBNAIL_SIZE
        ):
            return QualityProfile.OPTIMIZED

        # Large images might benefit from standard profile
        if (width and width >= self.LARGE_IMAGE_SIZE) or (
            height and height >= self.LARGE_IMAGE_SIZE
        ):
            return QualityProfile.STANDARD

        return self.default_profile

    def _normalize_format(self, image_format: str) -> str:
        """Normalize image format string.

        Args:
            image_format: Raw format string

        Returns:
            Normalized format string
        """
        format_lower = image_format.lower()
        if format_lower in ("jpg", "jpeg"):
            return "jpeg"
        return format_lower

    def _validate_quality(self, quality: int) -> int:
        """Validate quality value within acceptable range.

        Args:
            quality: Quality value to validate

        Returns:
            Validated quality value
        """
        return max(10, min(100, quality))

    def _apply_dynamic_adjustment(
        self, base_quality: int, file_size: int, image_format: str
    ) -> int:
        """Apply dynamic quality adjustment based on file size.

        Args:
            base_quality: Base quality setting
            file_size: Original file size in bytes
            image_format: Image format

        Returns:
            Adjusted quality setting
        """
        # For large files (>2MB), slightly reduce quality to improve processing
        if file_size > 2 * 1024 * 1024:  # 2MB
            if image_format == "jpeg":
                return max(base_quality - 5, 70)
            elif image_format == "webp":
                return max(base_quality - 5, 65)
            elif image_format == "avif":
                return max(base_quality - 5, 45)

        # For very small files (<50KB), can afford slightly higher quality
        elif file_size < 50 * 1024:  # 50KB
            if image_format == "jpeg":
                return min(base_quality + 5, 95)
            elif image_format == "webp":
                return min(base_quality + 5, 90)
            elif image_format == "avif":
                return min(base_quality + 5, 75)

        return base_quality
