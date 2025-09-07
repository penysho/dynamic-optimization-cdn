import { APIGatewayProxyResult } from "aws-lambda";
import { ErrorResponse, TransformParams } from "./types";

/**
 * Response building utilities
 * Handles creation of API Gateway responses
 */
export class ResponseBuilder {
  /**
   * Create successful image response
   * @param imageBuffer - Transformed image buffer
   * @param format - Image format
   * @returns API Gateway response
   */
  static createImageResponse(
    imageBuffer: Buffer,
    format?: string
  ): APIGatewayProxyResult {
    const contentType = format ? `image/${format}` : "image/jpeg";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000", // 1 year
        "Access-Control-Allow-Origin": "*",
        "Content-Length": imageBuffer.length.toString(),
      },
      body: imageBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  }

  /**
   * Create error response
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param details - Additional error details
   * @returns API Gateway response
   */
  static createErrorResponse(
    statusCode: number,
    message: string,
    details?: Record<string, unknown>
  ): APIGatewayProxyResult {
    const errorResponse: ErrorResponse & Record<string, unknown> = {
      error: message,
      ...details,
    };

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      body: JSON.stringify(errorResponse),
    };
  }

  /**
   * Create validation error response
   * @param message - Validation error message
   * @param field - Field that failed validation
   * @returns API Gateway response
   */
  static createValidationErrorResponse(
    message: string,
    field?: string
  ): APIGatewayProxyResult {
    return this.createErrorResponse(400, "Validation Error", {
      message,
      field,
    });
  }

  /**
   * Create not found error response
   * @param resource - Resource that was not found
   * @returns API Gateway response
   */
  static createNotFoundResponse(resource = "Resource"): APIGatewayProxyResult {
    return this.createErrorResponse(404, `${resource} not found`);
  }

  /**
   * Create forbidden error response
   * @param reason - Reason for forbidden access
   * @returns API Gateway response
   */
  static createForbiddenResponse(
    reason = "Access denied"
  ): APIGatewayProxyResult {
    return this.createErrorResponse(403, reason);
  }

  /**
   * Create internal server error response
   * @param message - Error message
   * @param includeDetails - Whether to include error details in response
   * @returns API Gateway response
   */
  static createInternalServerErrorResponse(
    message = "Internal server error",
    includeDetails = false
  ): APIGatewayProxyResult {
    const response = this.createErrorResponse(500, message);

    if (!includeDetails) {
      // Remove sensitive error details in production
      const body = JSON.parse(response.body);
      delete body.stack;
      delete body.details;
      response.body = JSON.stringify({ error: message });
    }

    return response;
  }

  /**
   * Create rate limit error response
   * @param retryAfter - Seconds to wait before retry
   * @returns API Gateway response
   */
  static createRateLimitResponse(retryAfter = 60): APIGatewayProxyResult {
    const response = this.createErrorResponse(429, "Too many requests");
    response.headers = {
      ...response.headers,
      "Retry-After": retryAfter.toString(),
    };
    return response;
  }

  /**
   * Create CORS preflight response
   * @returns API Gateway response for OPTIONS request
   */
  static createCorsPreflightResponse(): APIGatewayProxyResult {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Signature",
        "Access-Control-Max-Age": "86400", // 24 hours
      },
      body: "",
    };
  }

  /**
   * Add security headers to response
   * @param response - Response to modify
   * @returns Modified response with security headers
   */
  static addSecurityHeaders(
    response: APIGatewayProxyResult
  ): APIGatewayProxyResult {
    return {
      ...response,
      headers: {
        ...response.headers,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    };
  }

  /**
   * Add cache headers based on content type and transformation parameters
   * @param response - Response to modify
   * @param params - Transformation parameters
   * @returns Modified response with appropriate cache headers
   */
  static addCacheHeaders(
    response: APIGatewayProxyResult,
    params: TransformParams
  ): APIGatewayProxyResult {
    // Determine cache duration based on transformation complexity
    let maxAge = 31536000; // 1 year default

    if (params.smartCrop || params.blur || params.grayscale) {
      // Shorter cache for dynamic transformations
      maxAge = 86400; // 1 day
    }

    const cacheControl = `public, max-age=${maxAge}, immutable`;

    return {
      ...response,
      headers: {
        ...response.headers,
        "Cache-Control": cacheControl,
        ETag: this.generateETag(params),
      },
    };
  }

  /**
   * Generate ETag for response based on transformation parameters
   * @param params - Transformation parameters
   * @returns ETag string
   */
  private static generateETag(params: TransformParams): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    const hash = require("crypto")
      .createHash("md5")
      .update(paramString)
      .digest("hex");
    return `"${hash}"`;
  }
}
