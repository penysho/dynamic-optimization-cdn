"""Validation utilities for S3 Object Lambda image processing."""

from urllib.parse import unquote

from .types import ImageProcessingError, TransformParams


class RequestValidator:
    """Request validation utilities."""

    # Supported image formats
    SUPPORTED_FORMATS: set[str] = {"jpeg", "jpg", "png", "webp", "avif"}

    # Maximum dimensions (security measure)
    MAX_WIDTH = 2000
    MAX_HEIGHT = 2000

    # Quality range
    MIN_QUALITY = 10
    MAX_QUALITY = 100

    # Rotation values
    VALID_ROTATIONS: set[int] = {0, 90, 180, 270}

    # Fit values
    VALID_FIT_VALUES: set[str] = {"contain", "cover", "fill", "inside", "outside"}

    @staticmethod
    def parse_query_parameters(query_string: str) -> dict[str, str]:
        """Parse query parameters from URL query string.

        Args:
            query_string: URL query string

        Returns:
            Dictionary of parsed parameters
        """
        params = {}

        if not query_string:
            return params

        for param in query_string.split("&"):
            if "=" in param:
                key, value = param.split("=", 1)
                params[key] = unquote(value)

        return params

    @staticmethod
    def validate_transform_params(params: dict[str, str]) -> TransformParams:
        """Validate and convert transformation parameters.

        Args:
            params: Raw query parameters

        Returns:
            Validated transformation parameters

        Raises:
            ImageProcessingError: If parameters are invalid
        """
        validated_params: TransformParams = {}

        try:
            # Width validation
            if "w" in params:
                width = int(params["w"])
                if width <= 0:
                    raise ImageProcessingError("Width must be positive", 400)
                if width > RequestValidator.MAX_WIDTH:
                    raise ImageProcessingError(
                        f"Width cannot exceed {RequestValidator.MAX_WIDTH}px", 400
                    )
                validated_params["width"] = width

            # Height validation
            if "h" in params:
                height = int(params["h"])
                if height <= 0:
                    raise ImageProcessingError("Height must be positive", 400)
                if height > RequestValidator.MAX_HEIGHT:
                    raise ImageProcessingError(
                        f"Height cannot exceed {RequestValidator.MAX_HEIGHT}px", 400
                    )
                validated_params["height"] = height

            # Quality validation
            if "q" in params:
                quality = int(params["q"])
                if (
                    quality < RequestValidator.MIN_QUALITY
                    or quality > RequestValidator.MAX_QUALITY
                ):
                    raise ImageProcessingError(
                        f"Quality must be between {RequestValidator.MIN_QUALITY} and {RequestValidator.MAX_QUALITY}",
                        400,
                    )
                validated_params["quality"] = quality

            # Format validation
            if "f" in params:
                format_value = params["f"].lower()
                if format_value not in RequestValidator.SUPPORTED_FORMATS:
                    raise ImageProcessingError(
                        f"Unsupported format '{format_value}'. Supported formats: {', '.join(RequestValidator.SUPPORTED_FORMATS)}",
                        400,
                    )
                validated_params["format"] = format_value

            # Rotation validation
            if "r" in params:
                rotation = int(params["r"])
                if rotation not in RequestValidator.VALID_ROTATIONS:
                    raise ImageProcessingError(
                        f"Invalid rotation '{rotation}'. Valid values: {', '.join(map(str, RequestValidator.VALID_ROTATIONS))}",
                        400,
                    )
                validated_params["rotate"] = rotation

            # Fit validation
            if "fit" in params:
                fit_value = params["fit"].lower()
                if fit_value not in RequestValidator.VALID_FIT_VALUES:
                    raise ImageProcessingError(
                        f"Invalid fit value '{fit_value}'. Valid values: {', '.join(RequestValidator.VALID_FIT_VALUES)}",
                        400,
                    )
                validated_params["fit"] = fit_value

            # Boolean flags
            if "flip" in params:
                validated_params["flip"] = params["flip"].lower() in (
                    "true",
                    "1",
                    "yes",
                )

            if "flop" in params:
                validated_params["flop"] = params["flop"].lower() in (
                    "true",
                    "1",
                    "yes",
                )

            if "grayscale" in params or "greyscale" in params:
                validated_params["grayscale"] = True

            # Blur validation
            if "blur" in params:
                blur = float(params["blur"])
                if blur < 0 or blur > 100:
                    raise ImageProcessingError(
                        "Blur value must be between 0 and 100", 400
                    )
                validated_params["blur"] = blur

            # Smart crop
            if "smart" in params or "smartcrop" in params:
                validated_params["smart_crop"] = params.get(
                    "smart", params.get("smartcrop", "")
                ).lower() in ("true", "1", "yes")

        except ValueError as e:
            raise ImageProcessingError(f"Invalid parameter value: {e}", 400) from e

        return validated_params

    @staticmethod
    def validate_s3_key(s3_key: str) -> None:
        """Validate S3 object key.

        Args:
            s3_key: S3 object key

        Raises:
            ImageProcessingError: If S3 key is invalid
        """
        if not s3_key:
            raise ImageProcessingError("S3 key cannot be empty", 400)

        # Check for path traversal attempts
        if ".." in s3_key or s3_key.startswith("/"):
            raise ImageProcessingError("Invalid S3 key format", 400)

        # Basic file extension validation
        valid_extensions = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".avif",
            ".gif",
            ".bmp",
            ".tiff",
            ".tif",
        }
        if not any(s3_key.lower().endswith(ext) for ext in valid_extensions):
            raise ImageProcessingError("Unsupported file type", 400)

    @staticmethod
    def validate_content_type(content_type: str | None) -> None:
        """Validate content type header.

        Args:
            content_type: Content-Type header value

        Raises:
            ImageProcessingError: If content type is invalid
        """
        if not content_type:
            return

        valid_content_types = {
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/avif",
            "image/gif",
            "image/bmp",
            "image/tiff",
        }

        if content_type.lower().split(";")[0] not in valid_content_types:
            raise ImageProcessingError(f"Unsupported content type: {content_type}", 400)
