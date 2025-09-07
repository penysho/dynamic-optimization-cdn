import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as ApiGateway from "../lib/api-gateway-stack";

describe("ApiGatewayStack", () => {
  test("creates API Gateway with proxy resource", () => {
    const app = new cdk.App();
    const stack = new ApiGateway.ApiGatewayStack(app, "TestStack", {
      env: { account: "123456789012", region: "us-east-1" },
      createImageBucket: true,
    });
    const template = Template.fromStack(stack);

    // Check that API Gateway REST API is created
    template.hasResourceProperties("AWS::ApiGateway::RestApi", {
      Name: "TestStack-api",
      BinaryMediaTypes: ["*/*"],
    });

    // Check that proxy resource is created
    template.hasResourceProperties("AWS::ApiGateway::Resource", {
      PathPart: "{proxy+}",
    });

    // Check that ANY method is created for the proxy resource
    template.hasResourceProperties("AWS::ApiGateway::Method", {
      HttpMethod: "ANY",
      AuthorizationType: "NONE",
    });
  });

  test("creates Lambda function for image transformation", () => {
    const app = new cdk.App();
    const stack = new ApiGateway.ApiGatewayStack(app, "TestStack", {
      env: { account: "123456789012", region: "us-east-1" },
      createImageBucket: true,
    });
    const template = Template.fromStack(stack);

    // Check that Lambda function is created with container image
    template.hasResourceProperties("AWS::Lambda::Function", {
      PackageType: "Image",
    });
  });

  test("creates CloudFront distribution", () => {
    const app = new cdk.App();
    const stack = new ApiGateway.ApiGatewayStack(app, "TestStack", {
      env: { account: "123456789012", region: "us-east-1" },
      createImageBucket: true,
    });
    const template = Template.fromStack(stack);

    // Check that CloudFront distribution is created
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        Enabled: true,
      },
    });
  });

  test("throws error when no bucket is configured", () => {
    const app = new cdk.App();
    expect(() => {
      new ApiGateway.ApiGatewayStack(app, "TestStackNoBucket", {
        env: { account: "123456789012", region: "us-east-1" },
        // Neither createImageBucket nor existingImageBucketName provided
      });
    }).toThrow(
      /Either createImageBucket must be true or existingImageBucketName must be provided/
    );
  });
});
