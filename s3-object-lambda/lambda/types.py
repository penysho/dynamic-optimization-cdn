"""Type definitions for S3 Object Lambda image processing."""

from typing import Any, TypedDict


class Environment(TypedDict, total=False):
    """Environment variables interface."""

    AWS_REGION: str | None
    AWS_DEFAULT_REGION: str | None
    ENABLE_SIGNATURE: str | None
    SECRET_NAME: str | None
    IMAGE_BUCKET: str | None
    ENABLE_SMART_CROP: str | None
    ENABLE_CONTENT_MODERATION: str | None
    AUTO_WEBP: str | None
    ENABLE_DEFAULT_FALLBACK_IMAGE: str | None
    FALLBACK_IMAGE_S3_BUCKET: str | None
    FALLBACK_IMAGE_S3_KEY: str | None
    CORS_ENABLED: str | None
    CORS_ORIGIN: str | None
    LOG_LEVEL: str | None


class TransformParams(TypedDict, total=False):
    """Transformation parameters interface."""

    width: int | None
    height: int | None
    fit: str | None  # "contain" | "cover" | "fill" | "inside" | "outside"
    format: str | None  # "jpeg" | "jpg" | "png" | "webp" | "avif"
    quality: int | None
    rotate: int | None
    flip: bool | None
    flop: bool | None
    grayscale: bool | None
    blur: float | None
    smart_crop: bool | None


class EditsObject(TypedDict, total=False):
    """Edits object interface (Serverless Image Handler compatible)."""

    resize: dict[str, int | str] | None
    rotate: int | None
    flip: bool | None
    flop: bool | None
    grayscale: bool | None
    blur: float | None
    to_format: str | None
    jpeg: dict[str, int] | None
    png: dict[str, int] | None
    webp: dict[str, int] | None
    smart_crop: bool | None


class CropRegion(TypedDict):
    """Smart crop region interface."""

    left: int
    top: int
    width: int
    height: int


class ModerationResult(TypedDict):
    """Content moderation result interface."""

    inappropriate: bool


class ErrorResponse(TypedDict):
    """Error response interface."""

    error: str


class S3ObjectLambdaEvent(TypedDict):
    """S3 Object Lambda event structure."""

    getObjectContext: dict[str, str]
    userRequest: dict[str, Any]
    userIdentity: dict[str, str]
    protocolVersion: str


class GetObjectContext(TypedDict):
    """Get object context from S3 Object Lambda event."""

    inputS3Url: str
    outputRoute: str
    outputToken: str


class UserRequest(TypedDict):
    """User request from S3 Object Lambda event."""

    url: str
    headers: dict[str, str]


class ImageProcessingError(Exception):
    """Custom error class for image processing errors."""

    def __init__(
        self, message: str, status_code: int = 500, cause: Exception | None = None
    ):
        """Initialize image processing error.

        Args:
            message: Error message
            status_code: HTTP status code
            cause: Original exception that caused this error
        """
        super().__init__(message)
        self.status_code = status_code
        self.cause = cause


class AWSError(Exception):
    """AWS SDK error interface."""

    def __init__(
        self,
        message: str,
        code: str | None = None,
        status_code: int | None = None,
    ):
        """Initialize AWS error.

        Args:
            message: Error message
            code: AWS error code
            status_code: HTTP status code
        """
        super().__init__(message)
        self.code = code
        self.status_code = status_code
