import { ImageProcessingError, TransformParams } from "./types";

/**
 * Input validation utilities
 */
export class Validators {
  /**
   * Validate transformation parameters
   * @param params - Transformation parameters to validate
   * @throws {ImageProcessingError} If validation fails
   */
  static validateTransformParams(params: TransformParams): void {
    // Validate dimensions
    if (params.width !== undefined) {
      if (
        !Number.isInteger(params.width) ||
        params.width <= 0 ||
        params.width > 4096
      ) {
        throw new ImageProcessingError(
          "Width must be a positive integer <= 4096",
          400
        );
      }
    }

    if (params.height !== undefined) {
      if (
        !Number.isInteger(params.height) ||
        params.height <= 0 ||
        params.height > 4096
      ) {
        throw new ImageProcessingError(
          "Height must be a positive integer <= 4096",
          400
        );
      }
    }

    // Validate fit parameter
    if (params.fit !== undefined) {
      const validFits = ["contain", "cover", "fill", "inside", "outside"];
      if (!validFits.includes(params.fit)) {
        throw new ImageProcessingError(
          `Fit must be one of: ${validFits.join(", ")}`,
          400
        );
      }
    }

    // Validate format
    if (params.format !== undefined) {
      const validFormats = ["jpeg", "jpg", "png", "webp", "avif"];
      if (!validFormats.includes(params.format)) {
        throw new ImageProcessingError(
          `Format must be one of: ${validFormats.join(", ")}`,
          400
        );
      }
    }

    // Validate quality
    if (params.quality !== undefined) {
      if (
        !Number.isInteger(params.quality) ||
        params.quality < 1 ||
        params.quality > 100
      ) {
        throw new ImageProcessingError(
          "Quality must be an integer between 1 and 100",
          400
        );
      }
    }

    // Validate rotation
    if (params.rotate !== undefined) {
      if (
        !Number.isInteger(params.rotate) ||
        params.rotate < 0 ||
        params.rotate >= 360
      ) {
        throw new ImageProcessingError(
          "Rotation must be an integer between 0 and 359",
          400
        );
      }
    }

    // Validate blur
    if (params.blur !== undefined) {
      if (
        typeof params.blur !== "number" ||
        params.blur < 0 ||
        params.blur > 100
      ) {
        throw new ImageProcessingError(
          "Blur must be a number between 0 and 100",
          400
        );
      }
    }
  }

  /**
   * Validate S3 bucket name
   * @param bucket - Bucket name to validate
   * @throws {ImageProcessingError} If validation fails
   */
  static validateBucketName(bucket: string): void {
    if (!bucket || typeof bucket !== "string") {
      throw new ImageProcessingError("Bucket name is required", 400);
    }

    if (bucket.length < 3 || bucket.length > 63) {
      throw new ImageProcessingError(
        "Bucket name must be between 3 and 63 characters",
        400
      );
    }

    // Basic S3 bucket name validation
    const bucketRegex = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
    if (!bucketRegex.test(bucket)) {
      throw new ImageProcessingError("Invalid bucket name format", 400);
    }
  }

  /**
   * Validate S3 object key
   * @param key - Object key to validate
   * @throws {ImageProcessingError} If validation fails
   */
  static validateObjectKey(key: string): void {
    if (!key || typeof key !== "string") {
      throw new ImageProcessingError("Object key is required", 400);
    }

    if (key.length > 1024) {
      throw new ImageProcessingError(
        "Object key must be less than 1024 characters",
        400
      );
    }

    // Check for common image file extensions
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
      ".gif",
      ".bmp",
      ".tiff",
    ];
    const hasImageExtension = imageExtensions.some((ext) =>
      key.toLowerCase().endsWith(ext)
    );

    if (!hasImageExtension) {
      throw new ImageProcessingError(
        "Object key must have a valid image file extension",
        400
      );
    }
  }

  /**
   * Sanitize and validate query parameter value
   * @param value - Query parameter value
   * @param paramName - Parameter name for error messages
   * @returns Sanitized value
   */
  static sanitizeQueryParam(
    value: string | undefined,
    paramName: string
  ): string | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new ImageProcessingError(
        `Invalid ${paramName} parameter type`,
        400
      );
    }

    // Basic XSS prevention
    const sanitized = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "");

    return sanitized.trim();
  }

  /**
   * Parse and validate integer parameter
   * @param value - String value to parse
   * @param paramName - Parameter name for error messages
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @returns Parsed integer or undefined
   */
  static parseIntegerParam(
    value: string | undefined,
    paramName: string,
    min = 0,
    max = Number.MAX_SAFE_INTEGER
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new ImageProcessingError(
        `${paramName} must be a valid integer`,
        400
      );
    }

    if (parsed < min || parsed > max) {
      throw new ImageProcessingError(
        `${paramName} must be between ${min} and ${max}`,
        400
      );
    }

    return parsed;
  }

  /**
   * Parse and validate float parameter
   * @param value - String value to parse
   * @param paramName - Parameter name for error messages
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @returns Parsed float or undefined
   */
  static parseFloatParam(
    value: string | undefined,
    paramName: string,
    min = 0,
    max = Number.MAX_SAFE_INTEGER
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new ImageProcessingError(
        `${paramName} must be a valid number`,
        400
      );
    }

    if (parsed < min || parsed > max) {
      throw new ImageProcessingError(
        `${paramName} must be between ${min} and ${max}`,
        400
      );
    }

    return parsed;
  }
}
