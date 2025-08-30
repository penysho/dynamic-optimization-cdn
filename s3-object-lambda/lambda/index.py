import io
import json
import urllib.parse

import boto3
from PIL import Image

s3_client = boto3.client("s3")


def lambda_handler(event, context):
    """AWS Lambda function to process images dynamically using S3 Object Lambda.

    Supports query parameters: w (width), h (height), q (quality), f (format)
    """
    # Extract request information
    object_context = event["getObjectContext"]
    request_route = object_context["outputRoute"]
    request_token = object_context["outputToken"]
    s3_url = object_context["inputS3Url"]

    # Parse query parameters from user request
    user_request = event["userRequest"]
    query_string = user_request.get("url", "").split("?")
    params = {}

    if len(query_string) > 1:
        for param in query_string[1].split("&"):
            if "=" in param:
                key, value = param.split("=", 1)
                params[key] = urllib.parse.unquote(value)

    try:
        # Fetch the original image from S3
        response = urllib.request.urlopen(s3_url)
        original_image_bytes = response.read()

        # Process the image if transformation parameters are provided
        processed_image_bytes = process_image(original_image_bytes, params)

        # Write the processed image back to S3 Object Lambda
        s3_client.write_get_object_response(
            RequestRoute=request_route,
            RequestToken=request_token,
            Body=processed_image_bytes,
            ContentType=get_content_type(params.get("f", "jpeg")),
        )

    except Exception as e:
        print(f"Error processing image: {e!s}")

        # In case of error, return the original image
        try:
            response = urllib.request.urlopen(s3_url)
            original_image_bytes = response.read()

            s3_client.write_get_object_response(
                RequestRoute=request_route,
                RequestToken=request_token,
                Body=original_image_bytes,
                ContentType="application/octet-stream",
            )
        except Exception as fallback_error:
            print(f"Error returning original image: {fallback_error!s}")

            # Return error response
            s3_client.write_get_object_response(
                RequestRoute=request_route,
                RequestToken=request_token,
                Body=json.dumps({"error": "Image processing failed"}),
                ContentType="application/json",
                StatusCode=500,
            )


def process_image(image_bytes, params):
    """Process image based on query parameters.

    Args:
        image_bytes: Original image bytes
        params: Dictionary of query parameters (w, h, q, f)

    Returns:
        Processed image bytes
    """
    # If no transformation parameters, return original
    if not any(key in params for key in ["w", "h", "q", "f"]):
        return image_bytes

    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if necessary (for JPEG output)
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        # Get current dimensions
        original_width, original_height = image.size

        # Parse dimensions
        target_width = int(params.get("w", original_width))
        target_height = int(params.get("h", original_height))

        # Apply size limits (security measure)
        target_width = min(target_width, 2000)
        target_height = min(target_height, 2000)

        # Calculate aspect ratio preserving dimensions if only one dimension is specified
        if "w" in params and "h" not in params:
            aspect_ratio = original_height / original_width
            target_height = int(target_width * aspect_ratio)
        elif "h" in params and "w" not in params:
            aspect_ratio = original_width / original_height
            target_width = int(target_height * aspect_ratio)

        # Resize image if dimensions changed
        if (target_width, target_height) != (original_width, original_height):
            image = image.resize(
                (target_width, target_height), Image.Resampling.LANCZOS
            )

        # Determine output format
        output_format = params.get("f", "jpeg").upper()
        if output_format not in ["JPEG", "PNG", "WEBP"]:
            output_format = "JPEG"

        # Set quality
        quality = int(params.get("q", 85))
        quality = max(10, min(100, quality))  # Clamp between 10-100

        # Save processed image
        output_buffer = io.BytesIO()

        if output_format == "JPEG":
            image.save(output_buffer, format="JPEG", quality=quality, optimize=True)
        elif output_format == "PNG":
            image.save(output_buffer, format="PNG", optimize=True)
        elif output_format == "WEBP":
            image.save(output_buffer, format="WEBP", quality=quality, optimize=True)

        return output_buffer.getvalue()

    except Exception as e:
        print(f"Error in image processing: {e!s}")
        return image_bytes  # Return original on error


def get_content_type(format_param):
    """Get appropriate Content-Type header based on format parameter."""
    format_map = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }
    return format_map.get(format_param.lower(), "image/jpeg")
