#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiGatewayStack } from "../lib/api-gateway-stack";

const app = new cdk.App();

// Get configuration from CDK context or environment variables
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
  process.env.ENABLE_AUTO_WEBP === "true";
const createImageBucket =
  app.node.tryGetContext("createImageBucket") === "true" ||
  process.env.CREATE_IMAGE_BUCKET === "true";
const deploySampleImages =
  app.node.tryGetContext("deploySampleImages") === "true" ||
  process.env.DEPLOY_SAMPLE_IMAGES === "true";
const existingImageBucketName =
  app.node.tryGetContext("existingImageBucketName") ||
  process.env.EXISTING_IMAGE_BUCKET_NAME;

new ApiGatewayStack(app, "DynamicImageTransformationStack", {
  stackName: "dynamic-image-transformation",
  description:
    "Dynamic Image Transformation solution using API Gateway, Lambda, and CloudFront",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },

  // Stack configuration
  enableSignature,
  secretName,
  deployDemoUi,
  enableSmartCrop,
  enableContentModeration,
  enableAutoWebP,
  createImageBucket,
  deploySampleImages,
  existingImageBucketName,
  lambdaMemorySize: 1024,
  lambdaTimeout: 30,
});
