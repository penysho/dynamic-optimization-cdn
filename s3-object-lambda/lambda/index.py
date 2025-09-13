"""AWS Lambda function for S3 Object Lambda image processing.

Supports dynamic image transformation with comprehensive error handling and validation.
"""

import io
import json
from typing import Any
import urllib.request

from PIL import Image, ImageFilter, ImageOps

from aws_clients import AWSClients
from config import Config
from logger import get_logger
from models import (
    AWSError,
    ErrorResponse,
    ImageProcessingError,
    S3ObjectLambdaEvent,
    TransformParams,
)
from signature_validator import SignatureValidator
from validators import RequestValidator

# HTTP status codes
HTTP_NOT_FOUND = 404
HTTP_FORBIDDEN = 403
HTTP_INTERNAL_SERVER_ERROR = 500

# Initialize global components
config = Config()
logger = get_logger(__name__, config.log_level)
aws_clients = AWSClients(config)
signature_validator = SignatureValidator(config, aws_clients)

# Validate configuration at startup
try:
    config.validate()
    logger.info("Configuration validated successfully")
except Exception as e:
    logger.error("Configuration validation failed", error=str(e))
    raise


def lambda_handler(event: S3ObjectLambdaEvent, context: Any) -> None:
    """AWS Lambda function to process images dynamically using S3 Object Lambda.

    Args:
        event: S3 Object Lambda event
        context: Lambda context
    """
    logger.info(
        "Processing S3 Object Lambda request", request_id=context.aws_request_id
    )

    try:
        # Extract request information
        object_context = event["getObjectContext"]
        request_route = object_context["outputRoute"]
        request_token = object_context["outputToken"]
        s3_url = object_context["inputS3Url"]

        # Parse user request
        user_request = event["userRequest"]
        request_url = user_request.get("url", "")

        logger.debug(
            "Request details",
            s3_url=s3_url,
            request_url=request_url,
            request_route=request_route,
        )

        # Validate signature if enabled
        if config.is_signature_enabled:
            signature_validator.validate_signature(request_url)

        # Parse query parameters
        query_string = request_url.split("?", 1)[1] if "?" in request_url else ""
        raw_params = RequestValidator.parse_query_parameters(query_string)

        # Validate transformation parameters
        transform_params = RequestValidator.validate_transform_params(raw_params)

        logger.debug("Transformation parameters", params=transform_params)

        # Fetch and process the image
        processed_image_bytes = fetch_and_process_image(s3_url, transform_params)

        # Determine content type
        content_type = get_content_type(transform_params.get("format", "jpeg"))

        # Write response
        aws_clients.write_get_object_response(
            request_route=request_route,
            request_token=request_token,
            body=processed_image_bytes,
            content_type=content_type,
        )

        logger.info(
            "Image processing completed successfully",
            content_type=content_type,
            output_size=len(processed_image_bytes),
        )

    except ImageProcessingError as e:
        logger.warning(
            "Image processing error", error=str(e), status_code=e.status_code
        )
        handle_error(event, e)

    except AWSError as e:
        logger.error(
            "AWS service error",
            error=str(e),
            code=getattr(e, "code", None),
            status_code=e.status_code,
        )
        handle_error(
            event, ImageProcessingError("Service error", HTTP_INTERNAL_SERVER_ERROR, e)
        )

    except Exception as e:
        logger.error("Unexpected error", error=str(e), error_type=type(e).__name__)
        handle_error(
            event,
            ImageProcessingError(
                "Internal server error", HTTP_INTERNAL_SERVER_ERROR, e
            ),
        )


def fetch_and_process_image(s3_url: str, transform_params: TransformParams) -> bytes:
    """Fetch image from S3 and apply transformations.

    Args:
        s3_url: S3 URL to fetch image from
        transform_params: Validated transformation parameters

    Returns:
        Processed image bytes

    Raises:
        ImageProcessingError: If image processing fails
    """
    try:
        logger.debug("Fetching image from S3", s3_url=s3_url)

        # Fetch the original image from S3
        response = urllib.request.urlopen(s3_url)
        original_image_bytes = response.read()

        logger.debug("Image fetched successfully", size=len(original_image_bytes))

        # Process the image if transformation parameters are provided
        processed_image_bytes = process_image(original_image_bytes, transform_params)

        return processed_image_bytes

    except urllib.error.HTTPError as e:
        logger.error("HTTP error fetching image", status_code=e.code, error=str(e))
        if e.code == HTTP_NOT_FOUND:
            raise ImageProcessingError("Image not found", HTTP_NOT_FOUND) from e
        elif e.code == HTTP_FORBIDDEN:
            raise ImageProcessingError("Access denied to image", HTTP_FORBIDDEN) from e
        else:
            raise ImageProcessingError(
                f"Failed to fetch image: HTTP {e.code}", HTTP_INTERNAL_SERVER_ERROR
            ) from e

    except urllib.error.URLError as e:
        logger.error("URL error fetching image", error=str(e))
        raise ImageProcessingError(
            "Failed to fetch image: Network error", HTTP_INTERNAL_SERVER_ERROR
        ) from e

    except Exception as e:
        logger.error("Unexpected error fetching image", error=str(e))
        raise ImageProcessingError(
            "Failed to fetch image", HTTP_INTERNAL_SERVER_ERROR
        ) from e


def process_image(image_bytes: bytes, transform_params: TransformParams) -> bytes:
    """Process image based on transformation parameters.

    Args:
        image_bytes: Original image bytes
        transform_params: Validated transformation parameters

    Returns:
        Processed image bytes

    Raises:
        ImageProcessingError: If image processing fails
    """
    # If no transformation parameters, return original
    if not transform_params:
        logger.debug("No transformation parameters, returning original image")
        return image_bytes

    try:
        logger.debug("Starting image processing", params=transform_params)

        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))
        original_format = image.format
        original_size = image.size

        logger.debug(
            "Image opened successfully",
            format=original_format,
            mode=image.mode,
            size=original_size,
        )

        # Convert to RGB if necessary (for JPEG output or if image has transparency)
        if image.mode in ("RGBA", "LA", "P") and transform_params.get(
            "format", "jpeg"
        ).lower() in ("jpeg", "jpg"):
            # Create white background for JPEG conversion
            rgb_image = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            rgb_image.paste(
                image, mask=image.split()[-1] if image.mode in ("RGBA", "LA") else None
            )
            image = rgb_image

        # Apply transformations
        image = apply_transformations(image, transform_params)

        # Save processed image
        output_format = transform_params.get("format", "jpeg").upper()
        if output_format == "JPG":
            output_format = "JPEG"

        quality = transform_params.get("quality", 85)

        output_buffer = io.BytesIO()

        save_args = {"format": output_format, "optimize": True}

        if output_format in ("JPEG", "WEBP"):
            save_args["quality"] = quality
        elif output_format == "PNG":
            # PNG doesn't use quality, but we can control compression
            save_args["compress_level"] = 6

        image.save(output_buffer, **save_args)
        processed_bytes = output_buffer.getvalue()

        logger.debug(
            "Image processing completed",
            original_size=len(image_bytes),
            processed_size=len(processed_bytes),
            output_format=output_format,
            quality=quality,
        )

        return processed_bytes

    except Exception as e:
        logger.error(
            "Error in image processing", error=str(e), error_type=type(e).__name__
        )
        # Return original image on processing error
        return image_bytes


def apply_transformations(image: Image.Image, params: TransformParams) -> Image.Image:
    """Apply transformations to image.

    Args:
        image: PIL Image object
        params: Transformation parameters

    Returns:
        Transformed PIL Image object
    """
    # Apply size transformations
    image = _apply_resize(image, params)

    # Apply other transformations
    image = _apply_rotation_and_flips(image, params)
    image = _apply_color_effects(image, params)
    image = _apply_filters(image, params)

    return image


def _apply_resize(image: Image.Image, params: TransformParams) -> Image.Image:
    """Apply resize transformations."""
    original_width, original_height = image.size
    target_width = params.get("width")
    target_height = params.get("height")

    if not (target_width or target_height):
        return image

    if target_width and not target_height:
        aspect_ratio = original_height / original_width
        target_height = int(target_width * aspect_ratio)
    elif target_height and not target_width:
        aspect_ratio = original_width / original_height
        target_width = int(target_height * aspect_ratio)

    if target_width and target_height:
        fit_method = params.get("fit", "contain")

        if fit_method == "cover":
            image = ImageOps.fit(
                image, (target_width, target_height), Image.Resampling.LANCZOS
            )
        elif fit_method == "fill":
            image = image.resize(
                (target_width, target_height), Image.Resampling.LANCZOS
            )
        else:  # contain (default)
            image.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)

    return image


def _apply_rotation_and_flips(
    image: Image.Image, params: TransformParams
) -> Image.Image:
    """Apply rotation and flip transformations."""
    if params.get("rotate"):
        rotation = params["rotate"]
        image = image.rotate(-rotation, expand=True)  # PIL rotates counter-clockwise

    if params.get("flip"):
        image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

    if params.get("flop"):
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    return image


def _apply_color_effects(image: Image.Image, params: TransformParams) -> Image.Image:
    """Apply color effect transformations."""
    if params.get("grayscale"):
        image = ImageOps.grayscale(image)
        # Convert back to RGB if needed for color output formats
        if (
            params.get("format", "jpeg").lower() in ("jpeg", "jpg", "webp")
            and image.mode == "L"
        ):
            image = image.convert("RGB")

    return image


def _apply_filters(image: Image.Image, params: TransformParams) -> Image.Image:
    """Apply filter transformations."""
    if params.get("blur"):
        blur_radius = params["blur"]
        image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    # TODO: Implement smart crop using Rekognition if enabled
    if params.get("smart_crop") and config.is_smart_crop_enabled:
        logger.debug("Smart crop requested but not yet implemented")

    return image


def handle_error(event: S3ObjectLambdaEvent, error: ImageProcessingError) -> None:
    """Handle errors by returning appropriate responses.

    Args:
        event: S3 Object Lambda event
        error: Image processing error
    """
    try:
        object_context = event["getObjectContext"]
        request_route = object_context["outputRoute"]
        request_token = object_context["outputToken"]
        s3_url = object_context["inputS3Url"]

        # Try to return fallback image if configured
        if (
            config.is_default_fallback_image_enabled
            and error.status_code >= HTTP_INTERNAL_SERVER_ERROR
        ):
            try:
                fallback_bytes = get_fallback_image()
                if fallback_bytes:
                    aws_clients.write_get_object_response(
                        request_route=request_route,
                        request_token=request_token,
                        body=fallback_bytes,
                        content_type="image/jpeg",
                    )
                    logger.info("Returned fallback image")
                    return
            except Exception as fallback_error:
                logger.warning(
                    "Failed to return fallback image", error=str(fallback_error)
                )

        # Try to return original image for non-critical errors
        if error.status_code < HTTP_INTERNAL_SERVER_ERROR:
            try:
                response = urllib.request.urlopen(s3_url)
                original_image_bytes = response.read()

                aws_clients.write_get_object_response(
                    request_route=request_route,
                    request_token=request_token,
                    body=original_image_bytes,
                    content_type="application/octet-stream",
                )
                logger.info("Returned original image due to processing error")
                return
            except Exception as original_error:
                logger.warning(
                    "Failed to return original image", error=str(original_error)
                )

        # Return error response as last resort
        error_response: ErrorResponse = {"error": str(error)}
        aws_clients.write_get_object_response(
            request_route=request_route,
            request_token=request_token,
            body=json.dumps(error_response).encode("utf-8"),
            content_type="application/json",
            status_code=error.status_code,
        )

        logger.info("Returned error response", status_code=error.status_code)

    except Exception as e:
        logger.error("Failed to handle error", error=str(e))
        # At this point, we can't do much more


def get_fallback_image() -> bytes | None:
    """Get fallback image from S3.

    Returns:
        Fallback image bytes or None if not available
    """
    if not (config.fallback_image_s3_bucket and config.fallback_image_s3_key):
        return None

    try:
        logger.debug(
            "Fetching fallback image",
            bucket=config.fallback_image_s3_bucket,
            key=config.fallback_image_s3_key,
        )

        response = aws_clients.s3.get_object(
            Bucket=config.fallback_image_s3_bucket, Key=config.fallback_image_s3_key
        )

        fallback_bytes = response["Body"].read()
        logger.debug("Fallback image fetched successfully", size=len(fallback_bytes))

        return fallback_bytes

    except Exception as e:
        logger.error("Failed to fetch fallback image", error=str(e))
        return None


def get_content_type(format_param: str) -> str:
    """Get appropriate Content-Type header based on format parameter.

    Args:
        format_param: Image format parameter

    Returns:
        Content-Type header value
    """
    format_map = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "avif": "image/avif",
    }
    return format_map.get(format_param.lower(), "image/jpeg")
