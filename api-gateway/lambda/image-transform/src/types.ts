import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/**
 * Environment variables interface
 */
export interface Environment {
  readonly AWS_REGION?: string;
  readonly AWS_DEFAULT_REGION?: string;
  readonly ENABLE_SIGNATURE?: string;
  readonly SECRET_NAME?: string;
  readonly IMAGE_BUCKET?: string;
  readonly ENABLE_SMART_CROP?: string;
  readonly ENABLE_CONTENT_MODERATION?: string;
  readonly AUTO_WEBP?: string;
  readonly LOG_LEVEL?: string;
  [key: string]: string | undefined;
}

/**
 * Transformation parameters interface
 */
export interface TransformParams {
  width?: number | undefined;
  height?: number | undefined;
  fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
  format?: "jpeg" | "jpg" | "png" | "webp" | "avif" | undefined;
  quality?: number | undefined;
  rotate?: number | undefined;
  flip?: boolean;
  flop?: boolean;
  grayscale?: boolean;
  blur?: number | undefined;
  smartCrop?: boolean;
  [key: string]: unknown;
}

/**
 * Edits object interface (Serverless Image Handler compatible)
 */
export interface EditsObject {
  resize?: {
    width?: number;
    height?: number;
    fit?: TransformParams["fit"];
  };
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  grayscale?: boolean;
  blur?: number;
  toFormat?: TransformParams["format"];
  jpeg?: { quality?: number };
  png?: { quality?: number };
  webp?: { quality?: number };
  smartCrop?: boolean;
}

/**
 * Smart crop region interface
 */
export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

/**
 * Content moderation result interface
 */
export interface ModerationResult {
  inappropriate: boolean;
}

/**
 * Log level type
 */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Log data interface
 */
export interface LogData {
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: string;
}

/**
 * Custom error class for image processing errors
 */
export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/**
 * AWS SDK error interface
 */
export interface AWSError extends Error {
  code?: string;
  statusCode?: number;
  $metadata?: {
    httpStatusCode?: number;
  };
}

/**
 * Lambda handler type
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: import("aws-lambda").Context
) => Promise<APIGatewayProxyResult>;
