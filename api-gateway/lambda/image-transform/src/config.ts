import { Environment, LogLevel } from "./types";

/**
 * Application configuration class
 * Manages environment variables and application settings
 */
export class Config {
  private readonly env: Environment;

  constructor(env: Environment = process.env) {
    this.env = env;
  }

  /**
   * Get AWS region
   */
  get awsRegion(): string {
    return this.env.AWS_REGION || this.env.AWS_DEFAULT_REGION || "us-east-1";
  }

  /**
   * Check if signature validation is enabled
   */
  get isSignatureEnabled(): boolean {
    return this.env.ENABLE_SIGNATURE === "true";
  }

  /**
   * Get secret name for signature validation
   */
  get secretName(): string | undefined {
    return this.env.SECRET_NAME || undefined;
  }

  /**
   * Get configured image bucket name
   */
  get imageBucket(): string | undefined {
    return this.env.IMAGE_BUCKET || undefined;
  }

  /**
   * Check if smart crop is enabled
   */
  get isSmartCropEnabled(): boolean {
    return this.env.ENABLE_SMART_CROP === "true";
  }

  /**
   * Check if content moderation is enabled
   */
  get isContentModerationEnabled(): boolean {
    return this.env.ENABLE_CONTENT_MODERATION === "true";
  }

  /**
   * Check if auto WebP conversion is enabled
   */
  get isAutoWebPEnabled(): boolean {
    return this.env.AUTO_WEBP === "true";
  }

  /**
   * Get log level
   */
  get logLevel(): LogLevel {
    const level = this.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    return ["DEBUG", "INFO", "WARN", "ERROR"].includes(level) ? level : "INFO";
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validate(): void {
    if (this.isSignatureEnabled && !this.secretName) {
      throw new Error("SECRET_NAME must be set when ENABLE_SIGNATURE is true");
    }

    if (
      (this.isSmartCropEnabled || this.isContentModerationEnabled) &&
      !this.awsRegion
    ) {
      throw new Error("AWS_REGION must be set when using Rekognition services");
    }
  }
}
