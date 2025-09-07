import sharp, { Sharp } from "sharp";
import { AWSClients } from "./aws-clients";
import { Config } from "./config";
import { Logger } from "./logger";
import { CropRegion, ImageProcessingError, TransformParams } from "./types";

/**
 * Image processing service
 * Handles all image transformation operations using Sharp
 */
export class ImageProcessor {
  private readonly awsClients: AWSClients;
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(awsClients: AWSClients, logger: Logger, config: Config) {
    this.awsClients = awsClients;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Apply transformations to image buffer
   * @param imageBuffer - Original image buffer
   * @param params - Transformation parameters
   * @param bucket - S3 bucket name (for logging)
   * @param key - S3 object key (for logging)
   * @returns Transformed image buffer
   * @throws {ImageProcessingError} If transformation fails
   */
  async applyTransformations(
    imageBuffer: Buffer,
    params: TransformParams,
    bucket: string,
    key: string
  ): Promise<Buffer> {
    try {
      this.logger.info("Starting image transformation", {
        bucket,
        key,
        params,
        originalSize: imageBuffer.length,
      });

      let image: Sharp = sharp(imageBuffer);

      // Get metadata for smart operations
      const metadata = await image.metadata();

      this.logger.debug("Image metadata", {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
      });

      // Apply smart crop if enabled
      if (params.smartCrop && this.config.isSmartCropEnabled) {
        const cropRegion = await this.getSmartCropRegion(imageBuffer, metadata);
        if (cropRegion) {
          this.logger.debug("Applying smart crop", cropRegion);
          image = image.extract(cropRegion);
        }
      }

      // Apply resize transformation
      if (params.width || params.height) {
        image = this.applyResize(image, params);
      }

      // Apply rotation
      if (params.rotate !== undefined && params.rotate !== 0) {
        this.logger.debug("Applying rotation", { degrees: params.rotate });
        image = image.rotate(params.rotate);
      }

      // Apply flip/flop
      if (params.flip) {
        this.logger.debug("Applying flip");
        image = image.flip();
      }
      if (params.flop) {
        this.logger.debug("Applying flop");
        image = image.flop();
      }

      // Apply grayscale
      if (params.grayscale) {
        this.logger.debug("Applying grayscale");
        image = image.grayscale();
      }

      // Apply blur
      if (params.blur !== undefined && params.blur > 0) {
        this.logger.debug("Applying blur", { sigma: params.blur });
        image = image.blur(params.blur);
      }

      // Apply format conversion and quality settings
      image = this.applyFormatAndQuality(image, params);

      // Generate final buffer
      const transformedBuffer = await image.toBuffer();

      this.logger.info("Image transformation completed", {
        bucket,
        key,
        originalSize: imageBuffer.length,
        transformedSize: transformedBuffer.length,
        compressionRatio:
          ((transformedBuffer.length / imageBuffer.length) * 100).toFixed(2) +
          "%",
      });

      return transformedBuffer;
    } catch (error) {
      this.logger.error("Image transformation failed", {
        bucket,
        key,
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ImageProcessingError) {
        throw error;
      }

      throw new ImageProcessingError(
        "Failed to process image",
        500,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Apply resize transformation
   * @param image - Sharp image instance
   * @param params - Transformation parameters
   * @returns Sharp image instance with resize applied
   */
  private applyResize(image: Sharp, params: TransformParams): Sharp {
    const resizeOptions: sharp.ResizeOptions = {
      width: params.width,
      height: params.height,
      fit: params.fit || "contain",
      withoutEnlargement: true,
    };

    this.logger.debug(
      "Applying resize",
      resizeOptions as Record<string, unknown>
    );
    return image.resize(resizeOptions);
  }

  /**
   * Apply format conversion and quality settings
   * @param image - Sharp image instance
   * @param params - Transformation parameters
   * @returns Sharp image instance with format applied
   */
  private applyFormatAndQuality(image: Sharp, params: TransformParams): Sharp {
    if (!params.format) {
      return image;
    }

    const formatOptions: Record<string, unknown> = {};
    if (params.quality !== undefined) {
      formatOptions.quality = params.quality;
    }

    this.logger.debug("Applying format conversion", {
      format: params.format,
      options: formatOptions,
    });

    switch (params.format) {
      case "jpeg":
      case "jpg":
        return image.jpeg(formatOptions as sharp.JpegOptions);
      case "png":
        return image.png(formatOptions as sharp.PngOptions);
      case "webp":
        return image.webp(formatOptions as sharp.WebpOptions);
      case "avif":
        return image.avif(formatOptions as sharp.AvifOptions);
      default:
        // Fallback to toFormat for other formats
        return image.toFormat(
          params.format as keyof sharp.FormatEnum,
          formatOptions
        );
    }
  }

  /**
   * Get smart crop region using Amazon Rekognition face detection
   * @param imageBuffer - Image buffer
   * @param metadata - Image metadata
   * @returns Crop region or null if no faces detected
   */
  private async getSmartCropRegion(
    imageBuffer: Buffer,
    metadata: sharp.Metadata
  ): Promise<CropRegion | null> {
    try {
      if (!metadata.width || !metadata.height) {
        this.logger.warn("Cannot perform smart crop: missing image dimensions");
        return null;
      }

      const facesResult = await this.awsClients.detectFaces(imageBuffer);

      if (!facesResult.FaceDetails || facesResult.FaceDetails.length === 0) {
        this.logger.debug("No faces detected for smart crop");
        return null;
      }

      // Calculate bounding box that includes all faces
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;

      facesResult.FaceDetails.forEach((face) => {
        const box = face.BoundingBox;
        if (!box) return;

        minX = Math.min(minX, box.Left || 1);
        minY = Math.min(minY, box.Top || 1);
        maxX = Math.max(maxX, (box.Left || 0) + (box.Width || 0));
        maxY = Math.max(maxY, (box.Top || 0) + (box.Height || 0));
      });

      // Convert to pixel coordinates
      const left = Math.floor(minX * metadata.width);
      const top = Math.floor(minY * metadata.height);
      const width = Math.ceil((maxX - minX) * metadata.width);
      const height = Math.ceil((maxY - minY) * metadata.height);

      // Add padding (10% of face region size)
      const padding = 0.1;
      const paddedLeft = Math.max(0, left - width * padding);
      const paddedTop = Math.max(0, top - height * padding);
      const paddedWidth = Math.min(
        metadata.width - paddedLeft,
        width * (1 + 2 * padding)
      );
      const paddedHeight = Math.min(
        metadata.height - paddedTop,
        height * (1 + 2 * padding)
      );

      const cropRegion: CropRegion = {
        left: Math.floor(paddedLeft),
        top: Math.floor(paddedTop),
        width: Math.floor(paddedWidth),
        height: Math.floor(paddedHeight),
      };

      this.logger.debug("Smart crop region calculated", {
        faceCount: facesResult.FaceDetails.length,
        cropRegion,
      });

      return cropRegion;
    } catch (error) {
      this.logger.error("Smart crop region calculation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if image content is appropriate using Amazon Rekognition
   * @param imageBuffer - Image buffer
   * @returns True if content is inappropriate
   */
  async isContentInappropriate(imageBuffer: Buffer): Promise<boolean> {
    try {
      if (!this.config.isContentModerationEnabled) {
        return false;
      }

      const moderationResult = await this.awsClients.detectModerationLabels(
        imageBuffer,
        75
      );

      if (!moderationResult.ModerationLabels) {
        return false;
      }

      const inappropriateLabels = moderationResult.ModerationLabels.filter(
        (label) =>
          (label.Confidence || 0) > 90 &&
          ["Explicit Nudity", "Violence", "Visually Disturbing"].includes(
            label.ParentName || ""
          )
      );

      const isInappropriate = inappropriateLabels.length > 0;

      this.logger.info("Content moderation check completed", {
        totalLabels: moderationResult.ModerationLabels.length,
        inappropriateLabels: inappropriateLabels.length,
        isInappropriate,
      });

      return isInappropriate;
    } catch (error) {
      this.logger.error("Content moderation check failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fail open - allow image if moderation check fails
      return false;
    }
  }
}
