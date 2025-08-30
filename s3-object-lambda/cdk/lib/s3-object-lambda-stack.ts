import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3ObjectLambda from "aws-cdk-lib/aws-s3objectlambda";
import { Construct } from "constructs";
import * as path from "path";

export class S3ObjectLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html#using-S3-Object-Lambda

    // S3 bucket to store original images
    const originalImagesBucket = new s3.Bucket(this, "OriginalImagesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: "DeleteIncompleteMultipartUploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // S3 Bucket Policy
    new s3.CfnBucketPolicy(this, "BucketPolicy", {
      bucket: originalImagesBucket.bucketName,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: "*" },
            Action: ["s3:GetObject"],
            Resource: [
              `arn:aws:s3:::${originalImagesBucket.bucketName}`,
              `arn:aws:s3:::${originalImagesBucket.bucketName}/*`,
            ],
            Condition: {
              StringEquals: {
                "s3:DataAccessPointAccount": props?.env?.account,
              },
            },
          },
        ],
      },
    });

    // Lambda function for image processing
    const imageProcessingLambda = new lambda.Function(
      this,
      "ImageProcessingLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda")),
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          BUCKET_NAME: originalImagesBucket.bucketName,
        },
      }
    );

    // Grant Lambda permissions to access S3 bucket
    originalImagesBucket.grantRead(imageProcessingLambda);

    // Add permissions for S3 Object Lambda
    imageProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3-object-lambda:WriteGetObjectResponse"],
        resources: ["*"],
      })
    );

    // S3 Access Point for original images
    const accessPoint = new s3.CfnAccessPoint(
      this,
      "OriginalImagesAccessPoint",
      {
        bucket: originalImagesBucket.bucketName,
        name: "from-cloudfront-ap",
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "FromCloudFront",
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: ["s3:*"],
              Resource: [
                `arn:aws:s3:${props?.env?.region}:${props?.env?.account}:accesspoint/from-cloudfront-ap`,
                `arn:aws:s3:${props?.env?.region}:${props?.env?.account}:accesspoint/from-cloudfront-ap/object/*`,
              ],
              Condition: {
                "ForAnyValue:StringEquals": {
                  "aws:CalledVia": "s3-object-lambda.amazonaws.com",
                },
              },
            },
          ],
        },
      }
    );

    // S3 Object Lambda Access Point
    const objectLambdaAccessPoint = new s3ObjectLambda.CfnAccessPoint(
      this,
      "ObjectLambdaAccessPoint",
      {
        name: "image-processing-olap",
        objectLambdaConfiguration: {
          supportingAccessPoint: accessPoint.attrArn,
          transformationConfigurations: [
            {
              actions: ["GetObject"],
              contentTransformation: {
                AwsLambda: {
                  FunctionArn: imageProcessingLambda.functionArn,
                },
              },
            },
          ],
        },
      }
    );

    // Grant S3 Object Lambda permission to invoke the Lambda function
    imageProcessingLambda.grantInvoke(
      new iam.ServicePrincipal("s3-object-lambda.amazonaws.com")
    );

    // CloudFront Origin Request Policy
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "ObjectLambdaOriginRequestPolicy",
      {
        comment: "Policy for S3 Object Lambda origin",
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "CloudFront-Viewer-Country"
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      }
    );

    // CloudFront Cache Policy
    const cachePolicy = new cloudfront.CachePolicy(
      this,
      "ObjectLambdaCachePolicy",
      {
        comment: "Cache policy for dynamic image processing",
        defaultTtl: cdk.Duration.hours(24),
        maxTtl: cdk.Duration.days(7),
        minTtl: cdk.Duration.seconds(1),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
          "CloudFront-Viewer-Country"
        ),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
          "w",
          "h",
          "q",
          "f"
        ),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }
    );

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(
      this,
      "ImageCDNDistribution",
      {
        defaultBehavior: {
          origin: new origins.HttpOrigin(
            `${
              objectLambdaAccessPoint.attrArn.split(":")[5]
            }.s3-object-lambda.${cdk.Aws.REGION}.amazonaws.com`
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cachePolicy,
          originRequestPolicy: originRequestPolicy,
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        comment: "Dynamic Image Optimization CDN with S3 Object Lambda",
      }
    );

    // Grant CloudFront permission to invoke the Lambda function
    imageProcessingLambda.grantInvoke(
      new iam.ServicePrincipal("cloudfront.amazonaws.com")
    );

    // Add specific permission for CloudFront distribution
    imageProcessingLambda.addPermission("CloudFrontInvokePermission", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:cloudfront::${props?.env?.account}:distribution/${distribution.distributionId}`,
    });

    // S3 Object Lambda Access Point Policy
    new s3ObjectLambda.CfnAccessPointPolicy(
      this,
      "ObjectLambdaAccessPointPolicy",
      {
        objectLambdaAccessPoint: objectLambdaAccessPoint.ref,
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: ["s3-object-lambda:Get*"],
              Resource: `arn:aws:s3-object-lambda:${props?.env?.region}:${props?.env?.account}:accesspoint/${objectLambdaAccessPoint.ref}`,
              Condition: {
                StringEquals: {
                  "aws:SourceArn": `arn:aws:cloudfront::${props?.env?.account}:distribution/${distribution.distributionId}`,
                },
              },
            },
          ],
        },
      }
    );

    // Outputs
    new cdk.CfnOutput(this, "BucketName", {
      value: originalImagesBucket.bucketName,
      description: "Name of the S3 bucket for original images",
    });

    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront distribution domain name",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      description: "CloudFront distribution ID",
    });

    new cdk.CfnOutput(this, "ObjectLambdaAccessPointArn", {
      value: objectLambdaAccessPoint.attrArn,
      description: "S3 Object Lambda Access Point ARN",
    });
  }
}
