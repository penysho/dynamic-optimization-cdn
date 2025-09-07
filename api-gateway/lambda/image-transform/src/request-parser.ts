import { APIGatewayProxyEvent } from "aws-lambda";
import { Config } from "./config";
import { Logger } from "./logger";
import { EditsObject, ImageProcessingError, TransformParams } from "./types";
import { Validators } from "./validators";

/**
 * Request parsing service
 * Handles parsing and validation of API Gateway requests
 */
export class RequestParser {
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(logger: Logger, config: Config) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Extract bucket and key from API Gateway proxy path
   * Uses {proxy+} pattern where the entire path represents the S3 object key
   * The bucket is determined from IMAGE_BUCKET environment variable
   * @param event - API Gateway event
   * @returns Bucket and key information
   * @throws {ImageProcessingError} If path parameters are invalid or bucket not configured
   */
  extractBucketAndKey(event: APIGatewayProxyEvent): {
    bucket: string;
    key: string;
  } {
    // Bucket must be configured via IMAGE_BUCKET environment variable
    if (!this.config.imageBucket) {
      throw new ImageProcessingError(
        "IMAGE_BUCKET environment variable must be configured",
        500
      );
    }

    const bucket = this.config.imageBucket;
    let key: string;

    // Extract key from proxy path parameter
    if (event.pathParameters?.proxy) {
      key = event.pathParameters.proxy;
    } else if (event.path) {
      // Fallback: parse from full path (remove leading slash)
      key = event.path.startsWith("/") ? event.path.substring(1) : event.path;
      if (!key) {
        throw new ImageProcessingError("Empty key in path", 400);
      }
    } else {
      throw new ImageProcessingError("Missing key in path", 400);
    }

    // Validate key
    Validators.validateObjectKey(key);

    this.logger.debug("Extracted bucket and key", {
      bucket,
      key,
      proxyPath: event.pathParameters?.proxy,
      fullPath: event.path,
    });
    return { bucket, key };
  }

  /**
   * Parse transformation parameters from query string and headers
   * @param queryParams - Query string parameters
   * @param headers - Request headers
   * @returns Parsed transformation parameters
   * @throws {ImageProcessingError} If parameters are invalid
   */
  parseTransformParameters(
    queryParams: Record<string, string | undefined> | null,
    headers: Record<string, string | undefined>
  ): TransformParams {
    const params: TransformParams = {};

    // Handle base64 encoded edits parameter (compatible with Serverless Image Handler)
    if (queryParams?.edits) {
      try {
        const decodedEdits = Buffer.from(queryParams.edits, "base64").toString(
          "utf-8"
        );
        const edits: EditsObject = JSON.parse(decodedEdits);
        const parsedParams = this.parseEditsObject(edits, headers);

        this.logger.debug("Parsed edits parameter", { edits, parsedParams });
        return parsedParams;
      } catch (error) {
        this.logger.warn("Failed to parse edits parameter", {
          error: error instanceof Error ? error.message : String(error),
          edits: queryParams.edits,
        });
        throw new ImageProcessingError("Invalid edits parameter format", 400);
      }
    }

    // Parse individual query parameters
    if (queryParams) {
      const width = Validators.parseIntegerParam(
        queryParams.width,
        "width",
        1,
        4096
      );
      if (width !== undefined) params.width = width;

      const height = Validators.parseIntegerParam(
        queryParams.height,
        "height",
        1,
        4096
      );
      if (height !== undefined) params.height = height;

      if (queryParams.fit) {
        const fit = Validators.sanitizeQueryParam(queryParams.fit, "fit");
        if (
          fit &&
          ["contain", "cover", "fill", "inside", "outside"].includes(fit)
        ) {
          params.fit = fit as NonNullable<TransformParams["fit"]>;
        }
      }

      if (queryParams.format) {
        const format = Validators.sanitizeQueryParam(
          queryParams.format,
          "format"
        );
        if (format && ["jpeg", "jpg", "png", "webp", "avif"].includes(format)) {
          params.format = format as NonNullable<TransformParams["format"]>;
        }
      }

      const quality = Validators.parseIntegerParam(
        queryParams.quality,
        "quality",
        1,
        100
      );
      if (quality !== undefined) params.quality = quality;

      const rotate = Validators.parseIntegerParam(
        queryParams.rotate,
        "rotate",
        0,
        359
      );
      if (rotate !== undefined) params.rotate = rotate;

      params.flip = queryParams.flip === "true";
      params.flop = queryParams.flop === "true";
      params.grayscale =
        queryParams.grayscale === "true" || queryParams.greyscale === "true";

      const blur = Validators.parseFloatParam(queryParams.blur, "blur", 0, 100);
      if (blur !== undefined) params.blur = blur;

      params.smartCrop = queryParams.smartCrop === "true";
    }

    // Auto WebP conversion based on Accept header
    if (this.config.isAutoWebPEnabled && !params.format) {
      const acceptHeader = this.getHeaderValue(headers, "Accept") || "";
      if (acceptHeader.includes("image/webp")) {
        params.format = "webp";
        this.logger.debug(
          "Auto WebP conversion enabled based on Accept header"
        );
      }
    }

    // Validate parsed parameters
    Validators.validateTransformParams(params);

    this.logger.debug("Parsed transformation parameters", params);
    return params;
  }

  /**
   * Parse edits object (Serverless Image Handler compatible format)
   * @param edits - Edits object
   * @param headers - Request headers
   * @returns Parsed transformation parameters
   */
  private parseEditsObject(
    edits: EditsObject,
    headers: Record<string, string | undefined>
  ): TransformParams {
    const params: TransformParams = {};

    if (edits.resize) {
      if (edits.resize.width !== undefined) {
        params.width = edits.resize.width;
      }
      if (edits.resize.height !== undefined) {
        params.height = edits.resize.height;
      }
      if (edits.resize.fit) {
        params.fit = edits.resize.fit;
      }
    }

    if (edits.rotate !== undefined) params.rotate = edits.rotate;
    if (edits.flip) params.flip = true;
    if (edits.flop) params.flop = true;
    if (edits.grayscale) params.grayscale = true;
    if (edits.blur !== undefined) params.blur = edits.blur;
    if (edits.toFormat) params.format = edits.toFormat;
    if (edits.smartCrop) params.smartCrop = true;

    // Handle quality from format-specific options
    if (edits.jpeg?.quality !== undefined) params.quality = edits.jpeg.quality;
    if (edits.png?.quality !== undefined) params.quality = edits.png.quality;
    if (edits.webp?.quality !== undefined) params.quality = edits.webp.quality;

    // Auto WebP conversion based on Accept header
    if (this.config.isAutoWebPEnabled && !params.format) {
      const acceptHeader = this.getHeaderValue(headers, "Accept") || "";
      if (acceptHeader.includes("image/webp")) {
        params.format = "webp";
      }
    }

    return params;
  }

  /**
   * Get header value (case-insensitive)
   * @param headers - Headers object
   * @param headerName - Header name to find
   * @returns Header value or undefined
   */
  private getHeaderValue(
    headers: Record<string, string | undefined>,
    headerName: string
  ): string | undefined {
    const lowerHeaderName = headerName.toLowerCase();

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerHeaderName) {
        return value;
      }
    }

    return undefined;
  }
}
