import { APIGatewayProxyEvent } from "aws-lambda";
import { createHmac } from "crypto";
import { AWSClients } from "./aws-clients";
import { Config } from "./config";
import { Logger } from "./logger";
import { ImageProcessingError } from "./types";

/**
 * Signature validation service
 * Handles HMAC signature validation for request authentication
 */
export class SignatureValidator {
  private readonly awsClients: AWSClients;
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(awsClients: AWSClients, logger: Logger, config: Config) {
    this.awsClients = awsClients;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Validate request signature
   * @param event - API Gateway event
   * @returns True if signature is valid
   * @throws {ImageProcessingError} If signature validation fails
   */
  async validateSignature(event: APIGatewayProxyEvent): Promise<boolean> {
    if (!this.config.isSignatureEnabled) {
      this.logger.debug("Signature validation is disabled");
      return true;
    }

    if (!this.config.secretName) {
      throw new ImageProcessingError(
        "Secret name not configured for signature validation",
        500
      );
    }

    try {
      // Extract signature from headers
      const signature = this.extractSignature(event.headers);
      if (!signature) {
        this.logger.warn("Missing signature in request headers");
        return false;
      }

      // Get secret from AWS Secrets Manager
      const secret = await this.awsClients.getSecretValue(
        this.config.secretName
      );

      // Create expected signature
      const stringToSign = this.createStringToSign(event);
      const expectedSignature = this.createSignature(stringToSign, secret);

      // Compare signatures using constant-time comparison
      const isValid = this.constantTimeCompare(signature, expectedSignature);

      this.logger.debug("Signature validation result", {
        isValid,
        stringToSign:
          this.config.logLevel === "DEBUG" ? stringToSign : "[REDACTED]",
      });

      return isValid;
    } catch (error) {
      this.logger.error("Signature validation failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ImageProcessingError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Extract signature from request headers
   * @param headers - Request headers
   * @returns Signature string or null
   */
  private extractSignature(
    headers: Record<string, string | undefined>
  ): string | null {
    // Check common signature header names (case-insensitive)
    const signatureHeaders = ["X-Signature", "Authorization", "Signature"];

    for (const headerName of signatureHeaders) {
      const signature = this.getHeaderValue(headers, headerName);
      if (signature) {
        // Handle Authorization header with different schemes
        if (headerName === "Authorization") {
          const match = signature.match(
            /^(?:Bearer|HMAC-SHA256|Signature)\s+(.+)$/i
          );
          return match ? match[1] || null : signature;
        }
        return signature;
      }
    }

    return null;
  }

  /**
   * Create string to sign from API Gateway event
   * @param event - API Gateway event
   * @returns String to sign
   */
  private createStringToSign(event: APIGatewayProxyEvent): string {
    const path = event.path || "";
    const queryString = event.queryStringParameters
      ? Object.entries(event.queryStringParameters)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${value}`)
          .join("&")
      : "";
    const method = event.httpMethod || "GET";

    // Include HTTP method, path, and query string in signature
    let stringToSign = `${method}\n${path}`;

    if (queryString) {
      stringToSign += `\n${queryString}`;
    }

    return stringToSign;
  }

  /**
   * Create HMAC-SHA256 signature
   * @param stringToSign - String to sign
   * @param secret - Secret key
   * @returns HMAC signature (hex encoded)
   */
  private createSignature(stringToSign: string, secret: string): string {
    return createHmac("sha256", secret)
      .update(stringToSign, "utf8")
      .digest("hex");
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
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
