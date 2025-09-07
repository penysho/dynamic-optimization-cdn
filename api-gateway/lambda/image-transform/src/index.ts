import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { AWSClients } from "./aws-clients";
import { Config } from "./config";
import { ImageProcessor } from "./image-processor";
import { Logger } from "./logger";
import { RequestParser } from "./request-parser";
import { ResponseBuilder } from "./response-builder";
import { SignatureValidator } from "./signature-validator";
import { ImageProcessingError, LambdaHandler } from "./types";

/**
 * Main Lambda handler class
 * Orchestrates the image transformation process
 */
export class ImageTransformHandler {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly awsClients: AWSClients;
  private readonly imageProcessor: ImageProcessor;
  private readonly requestParser: RequestParser;
  private readonly signatureValidator: SignatureValidator;

  constructor() {
    this.config = new Config();
    this.logger = new Logger(this.config.logLevel);
    this.awsClients = new AWSClients(this.config, this.logger);
    this.imageProcessor = new ImageProcessor(
      this.awsClients,
      this.logger,
      this.config
    );
    this.requestParser = new RequestParser(this.logger, this.config);
    this.signatureValidator = new SignatureValidator(
      this.awsClients,
      this.logger,
      this.config
    );
  }

  /**
   * Handle API Gateway request
   * @param event - API Gateway event
   * @param context - Lambda context
   * @returns API Gateway response
   */
  async handle(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    const startTime = Date.now();

    try {
      // Validate configuration
      this.config.validate();

      // Log request details
      this.logger.info("Processing image transformation request", {
        requestId: context.awsRequestId,
        path: event.path,
        httpMethod: event.httpMethod,
        queryStringParameters: event.queryStringParameters,
        userAgent: event.headers["User-Agent"] || event.headers["user-agent"],
      });

      // Handle CORS preflight requests
      if (event.httpMethod === "OPTIONS") {
        return ResponseBuilder.addSecurityHeaders(
          ResponseBuilder.createCorsPreflightResponse()
        );
      }

      // Extract bucket and key from path
      const { bucket, key } = this.requestParser.extractBucketAndKey(event);

      // Parse transformation parameters
      const transformParams = this.requestParser.parseTransformParameters(
        event.queryStringParameters,
        event.headers
      );

      // Validate signature if enabled
      const isSignatureValid = await this.signatureValidator.validateSignature(
        event
      );
      if (!isSignatureValid) {
        this.logger.warn("Invalid request signature", {
          requestId: context.awsRequestId,
          path: event.path,
        });
        return ResponseBuilder.addSecurityHeaders(
          ResponseBuilder.createForbiddenResponse("Invalid signature")
        );
      }

      // Get original image from S3
      this.logger.info("Fetching image from S3", { bucket, key });
      const originalImageBuffer = await this.awsClients.getImageFromS3(
        bucket,
        key
      );

      // Check content moderation if enabled
      if (this.config.isContentModerationEnabled) {
        const isInappropriate =
          await this.imageProcessor.isContentInappropriate(originalImageBuffer);
        if (isInappropriate) {
          this.logger.warn("Inappropriate content detected", {
            requestId: context.awsRequestId,
            bucket,
            key,
          });
          return ResponseBuilder.addSecurityHeaders(
            ResponseBuilder.createForbiddenResponse(
              "Inappropriate content detected"
            )
          );
        }
      }

      // Apply transformations
      const transformedImageBuffer =
        await this.imageProcessor.applyTransformations(
          originalImageBuffer,
          transformParams,
          bucket,
          key
        );

      // Create successful response
      const response = ResponseBuilder.createImageResponse(
        transformedImageBuffer,
        transformParams.format
      );

      // Add cache and security headers
      const finalResponse = ResponseBuilder.addSecurityHeaders(
        ResponseBuilder.addCacheHeaders(response, transformParams)
      );

      // Log success
      const processingTime = Date.now() - startTime;
      this.logger.info("Image transformation completed successfully", {
        requestId: context.awsRequestId,
        bucket,
        key,
        transformParams,
        originalSize: originalImageBuffer.length,
        transformedSize: transformedImageBuffer.length,
        processingTimeMs: processingTime,
      });

      return finalResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error("Image transformation failed", {
        requestId: context.awsRequestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: processingTime,
      });

      // Handle specific error types
      if (error instanceof ImageProcessingError) {
        return ResponseBuilder.addSecurityHeaders(
          ResponseBuilder.createErrorResponse(error.statusCode, error.message)
        );
      }

      // Handle unexpected errors
      return ResponseBuilder.addSecurityHeaders(
        ResponseBuilder.createInternalServerErrorResponse()
      );
    }
  }
}

// Create handler instance
const handlerInstance = new ImageTransformHandler();

/**
 * AWS Lambda handler function
 * @param event - API Gateway event
 * @param context - Lambda context
 * @returns API Gateway response
 */
export const handler: LambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  return handlerInstance.handle(event, context);
};

// For Lambda container compatibility, also export using module.exports
module.exports = { handler };
