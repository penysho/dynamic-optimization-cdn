#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3ObjectLambdaStack } from "../lib/s3-object-lambda-stack";

const app = new cdk.App();

// Configuration from context or environment
const enableSignature =
  app.node.tryGetContext("enableSignature") === "true" ||
  process.env.ENABLE_SIGNATURE === "true";
const secretName =
  app.node.tryGetContext("secretName") || process.env.SECRET_NAME;
const deployDemoUi = app.node.tryGetContext("deployDemoUi") !== "false";
const enableSmartCrop =
  app.node.tryGetContext("enableSmartCrop") === "true" ||
  process.env.ENABLE_SMART_CROP === "true";
const enableContentModeration =
  app.node.tryGetContext("enableContentModeration") === "true" ||
  process.env.ENABLE_CONTENT_MODERATION === "true";
const enableAutoWebP =
  app.node.tryGetContext("enableAutoWebP") === "true" ||
  process.env.AUTO_WEBP === "true";
const deploySampleImages =
  app.node.tryGetContext("deploySampleImages") !== "false";
const enableDefaultFallbackImage =
  app.node.tryGetContext("enableDefaultFallbackImage") === "true";
const fallbackImageS3Bucket =
  app.node.tryGetContext("fallbackImageS3Bucket") ||
  process.env.FALLBACK_IMAGE_S3_BUCKET;
const fallbackImageS3Key =
  app.node.tryGetContext("fallbackImageS3Key") ||
  process.env.FALLBACK_IMAGE_S3_KEY;
const enableCors = app.node.tryGetContext("enableCors") === "true";
const corsOrigin =
  app.node.tryGetContext("corsOrigin") || process.env.CORS_ORIGIN || "*";

// Define Stacks
new S3ObjectLambdaStack(app, "DynamicImageTransformationStack", {
  stackName: "s3-object-lambda",
  description:
    "Dynamic Image Transformation solution using S3 Object Lambda, Lambda, and CloudFront",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  enableSignature,
  secretName,
  deployDemoUi,
  enableSmartCrop,
  enableContentModeration,
  enableAutoWebP,
  lambdaMemorySize: 1024,
  lambdaTimeout: 30,
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
  deploySampleImages,
  enableDefaultFallbackImage,
  fallbackImageS3Bucket,
  fallbackImageS3Key,
  enableCors,
  corsOrigin,
});
