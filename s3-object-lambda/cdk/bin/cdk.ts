#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { S3ObjectLambdaStack } from "../lib/s3-object-lambda-stack";

const app = new cdk.App();

const envProps = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const projectName = "s3-object-lambda";
const deployEnv = "demo";

// Define Stacks
new S3ObjectLambdaStack(app, `${projectName}-${deployEnv}-s3-object-lambda`, {
  env: envProps,
});
