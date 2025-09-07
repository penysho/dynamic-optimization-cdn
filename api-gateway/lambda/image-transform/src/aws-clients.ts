import {
  DetectFacesCommand,
  DetectFacesCommandOutput,
  DetectModerationLabelsCommand,
  DetectModerationLabelsCommandOutput,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import {
  GetObjectCommand,
  GetObjectCommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Config } from "./config";
import { Logger } from "./logger";
import { AWSError, ImageProcessingError } from "./types";

/**
 * AWS clients manager
 * Centralizes AWS service client initialization and operations
 */
export class AWSClients {
  private readonly s3Client: S3Client;
  private readonly secretsManagerClient: SecretsManagerClient;
  private readonly rekognitionClient: RekognitionClient;
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.awsRegion,
      forcePathStyle: false,
      useAccelerateEndpoint: false,
    });

    // Initialize Secrets Manager client
    this.secretsManagerClient = new SecretsManagerClient({
      region: config.awsRegion,
    });

    // Initialize Rekognition client
    this.rekognitionClient = new RekognitionClient({
      region: config.awsRegion,
    });
  }

  /**
   * Get image from S3 bucket
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   * @returns Image buffer
   * @throws {ImageProcessingError} If image retrieval fails
   */
  async getImageFromS3(bucket: string, key: string): Promise<Buffer> {
    try {
      const decodedKey = decodeURIComponent(key);

      this.logger.info("Fetching image from S3", {
        bucket,
        key: decodedKey,
        region: this.config.awsRegion,
      });

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: decodedKey,
      });

      const response: GetObjectCommandOutput = await this.s3Client.send(
        command
      );

      if (!response.Body) {
        throw new ImageProcessingError("Empty response body from S3", 404);
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      this.logger.info("Successfully retrieved image from S3", {
        bucket,
        key: decodedKey,
        bufferSize: buffer.length,
        contentType: response.ContentType,
      });

      return buffer;
    } catch (error) {
      const awsError = error as AWSError;

      this.logger.error("Failed to get image from S3", {
        bucket,
        key: decodeURIComponent(key),
        region: this.config.awsRegion,
        error: awsError.message,
        code: awsError.code,
      });

      // Map AWS errors to appropriate HTTP status codes
      switch (awsError.code || awsError.name) {
        case "NoSuchKey":
          throw new ImageProcessingError("Image not found", 404, awsError);
        case "NoSuchBucket":
          throw new ImageProcessingError("Bucket not found", 404, awsError);
        case "AccessDenied":
          throw new ImageProcessingError(
            "Access denied to bucket or object",
            403,
            awsError
          );
        case "InvalidBucketName":
          throw new ImageProcessingError("Invalid bucket name", 400, awsError);
        case "PermanentRedirect":
          throw new ImageProcessingError(
            "Invalid bucket endpoint. Please check the bucket region.",
            400,
            awsError
          );
        default:
          throw new ImageProcessingError(
            "Failed to retrieve image from S3",
            500,
            awsError
          );
      }
    }
  }

  /**
   * Get secret value from AWS Secrets Manager
   * @param secretName - Secret name
   * @returns Secret string value
   * @throws {ImageProcessingError} If secret retrieval fails
   */
  async getSecretValue(secretName: string): Promise<string> {
    try {
      this.logger.debug("Retrieving secret from Secrets Manager", {
        secretName,
      });

      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsManagerClient.send(command);

      if (!response.SecretString) {
        throw new ImageProcessingError("Secret value is empty", 500);
      }

      this.logger.debug("Successfully retrieved secret");
      return response.SecretString;
    } catch (error) {
      const awsError = error as AWSError;

      this.logger.error("Failed to retrieve secret", {
        secretName,
        error: awsError.message,
        code: awsError.code,
      });

      throw new ImageProcessingError(
        "Failed to retrieve secret",
        500,
        awsError
      );
    }
  }

  /**
   * Detect faces in image using Amazon Rekognition
   * @param imageBuffer - Image buffer
   * @returns Face detection result
   * @throws {ImageProcessingError} If face detection fails
   */
  async detectFaces(imageBuffer: Buffer): Promise<DetectFacesCommandOutput> {
    try {
      this.logger.debug("Detecting faces using Rekognition", {
        imageSize: imageBuffer.length,
      });

      const command = new DetectFacesCommand({
        Image: {
          Bytes: imageBuffer,
        },
        Attributes: ["DEFAULT"],
      });

      const result = await this.rekognitionClient.send(command);

      this.logger.debug("Face detection completed", {
        faceCount: result.FaceDetails?.length || 0,
      });

      return result;
    } catch (error) {
      const awsError = error as AWSError;

      this.logger.error("Face detection failed", {
        error: awsError.message,
        code: awsError.code,
      });

      throw new ImageProcessingError("Face detection failed", 500, awsError);
    }
  }

  /**
   * Detect moderation labels in image using Amazon Rekognition
   * @param imageBuffer - Image buffer
   * @param minConfidence - Minimum confidence threshold
   * @returns Moderation detection result
   * @throws {ImageProcessingError} If moderation detection fails
   */
  async detectModerationLabels(
    imageBuffer: Buffer,
    minConfidence = 75
  ): Promise<DetectModerationLabelsCommandOutput> {
    try {
      this.logger.debug("Detecting moderation labels using Rekognition", {
        imageSize: imageBuffer.length,
        minConfidence,
      });

      const command = new DetectModerationLabelsCommand({
        Image: {
          Bytes: imageBuffer,
        },
        MinConfidence: minConfidence,
      });

      const result = await this.rekognitionClient.send(command);

      this.logger.debug("Moderation detection completed", {
        labelCount: result.ModerationLabels?.length || 0,
      });

      return result;
    } catch (error) {
      const awsError = error as AWSError;

      this.logger.error("Moderation detection failed", {
        error: awsError.message,
        code: awsError.code,
      });

      throw new ImageProcessingError(
        "Moderation detection failed",
        500,
        awsError
      );
    }
  }
}
