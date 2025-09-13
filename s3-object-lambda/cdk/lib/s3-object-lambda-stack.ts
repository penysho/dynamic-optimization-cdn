import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as s3ObjectLambda from "aws-cdk-lib/aws-s3objectlambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as path from "path";

export interface S3ObjectLambdaStackProps extends cdk.StackProps {
  /**
   * Enable request signature validation
   * @default false
   */
  enableSignature?: boolean;

  /**
   * Secret name in AWS Secrets Manager for signature validation
   * @default undefined
   */
  secretName?: string;

  /**
   * Deploy demo UI
   * @default false
   */
  deployDemoUi?: boolean;

  /**
   * Enable smart crop using Amazon Rekognition
   * @default false
   */
  enableSmartCrop?: boolean;

  /**
   * Enable content moderation using Amazon Rekognition
   * @default false
   */
  enableContentModeration?: boolean;

  /**
   * Enable automatic WebP conversion based on Accept headers
   * @default false
   */
  enableAutoWebP?: boolean;

  /**
   * Lambda memory size in MB
   * @default 1024
   */
  lambdaMemorySize?: number;

  /**
   * Lambda timeout in seconds
   * @default 30
   */
  lambdaTimeout?: number;

  /**
   * CloudFront price class
   * @default PriceClass.PRICE_CLASS_100
   */
  priceClass?: cloudfront.PriceClass;

  /**
   * Deploy sample images to the created bucket
   * @default false
   */
  deploySampleImages?: boolean;

  /**
   * Enable default fallback image
   * @default false
   */
  enableDefaultFallbackImage?: boolean;

  /**
   * Fallback image S3 bucket name
   * @default undefined
   */
  fallbackImageS3Bucket?: string;

  /**
   * Fallback image S3 key
   * @default undefined
   */
  fallbackImageS3Key?: string;

  /**
   * Enable CORS
   * @default false
   */
  enableCors?: boolean;

  /**
   * CORS origin
   * @default "*"
   */
  corsOrigin?: string;
}

export class S3ObjectLambdaStack extends cdk.Stack {
  public readonly distribution: cloudfront.CfnDistribution;
  public readonly imageProcessingFunction: lambda.Function;
  public readonly logsBucket: s3.Bucket;
  public readonly originalImagesBucket: s3.Bucket;
  public readonly objectLambdaAccessPoint: s3ObjectLambda.CfnAccessPoint;

  constructor(scope: Construct, id: string, props?: S3ObjectLambdaStackProps) {
    super(scope, id, props);

    const {
      enableSignature = false,
      secretName,
      deployDemoUi = false,
      enableSmartCrop = false,
      enableContentModeration = false,
      enableAutoWebP = false,
      lambdaMemorySize = 1024,
      lambdaTimeout = 30,
      priceClass = cloudfront.PriceClass.PRICE_CLASS_100,
      deploySampleImages = false,
      enableDefaultFallbackImage = false,
      fallbackImageS3Bucket,
      fallbackImageS3Key,
      enableCors = false,
      corsOrigin = "*",
    } = props || {};

    // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html#using-S3-Object-Lambda

    // Create S3 bucket for logs
    this.logsBucket = new s3.Bucket(this, "LogsBucket", {
      bucketName: `${this.stackName}-log-${this.account}`.toLowerCase(),
      lifecycleRules: [
        {
          id: "ExpireLogs",
          expiration: cdk.Duration.days(90),
        },
      ],
      // Allow CloudFront to write logs by enabling ACL access
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: true,
        ignorePublicAcls: false,
        restrictPublicBuckets: true,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant CloudFront service permission to write logs to the bucket
    this.logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:PutObject", "s3:GetBucketAcl", "s3:PutBucketAcl"],
        resources: [
          this.logsBucket.bucketArn,
          `${this.logsBucket.bucketArn}/*`,
        ],
      })
    );

    // S3 bucket to store original images
    this.originalImagesBucket = new s3.Bucket(this, "OriginalImagesBucket", {
      bucketName: `${this.stackName}-img-${this.account}`.toLowerCase(),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: enableCors
        ? [
            {
              allowedHeaders: ["*"],
              allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
              allowedOrigins: [corsOrigin],
              maxAge: 3000,
            },
          ]
        : undefined,
      lifecycleRules: [
        {
          id: "DeleteIncompleteMultipartUploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // Deploy sample images if requested
    if (deploySampleImages) {
      new s3deploy.BucketDeployment(this, "DeploySampleImages", {
        sources: [
          s3deploy.Source.asset(path.join(__dirname, "../../sample-images")),
        ],
        destinationBucket: this.originalImagesBucket,
        destinationKeyPrefix: "samples/",
      });
    }

    // Lambda function for image processing using container image
    this.imageProcessingFunction = new lambda.Function(
      this,
      "ImageProcessingLambda",
      {
        code: lambda.Code.fromAssetImage(path.join(__dirname, "../../lambda"), {
          buildArgs: {
            "--platform": "linux/amd64",
          },
          platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64, // Without this property, Lambda will not run due to "Runtime.InvalidEntrypoint".
        }),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
        architecture: lambda.Architecture.X86_64,
        timeout: cdk.Duration.seconds(Math.min(lambdaTimeout, 29)),
        memorySize: lambdaMemorySize,
        environment: {
          ENABLE_SIGNATURE: enableSignature.toString(),
          SECRET_NAME: secretName || "",
          IMAGE_BUCKET: this.originalImagesBucket.bucketName,
          ENABLE_SMART_CROP: enableSmartCrop.toString(),
          ENABLE_CONTENT_MODERATION: enableContentModeration.toString(),
          AUTO_WEBP: enableAutoWebP.toString(),
          ENABLE_DEFAULT_FALLBACK_IMAGE: enableDefaultFallbackImage.toString(),
          FALLBACK_IMAGE_S3_BUCKET: fallbackImageS3Bucket || "",
          FALLBACK_IMAGE_S3_KEY: fallbackImageS3Key || "",
          CORS_ENABLED: enableCors.toString(),
          CORS_ORIGIN: corsOrigin,
          LOG_LEVEL: "INFO",
        },
        logGroup: new logs.LogGroup(this, "ImageProcessingFunctionLogGroup", {
          logGroupName: `/aws/lambda/${this.stackName}-ImageProcessingFunction`,
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }
    );

    // Grant Lambda permissions to access S3 bucket
    this.originalImagesBucket.grantRead(this.imageProcessingFunction);

    // Add permissions for S3 Object Lambda
    this.imageProcessingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3-object-lambda:WriteGetObjectResponse"],
        resources: ["*"],
      })
    );

    // Grant Secrets Manager read permissions if signature is enabled
    if (enableSignature && secretName) {
      const secret = secretsmanager.Secret.fromSecretNameV2(
        this,
        "SignatureSecret",
        secretName
      );
      secret.grantRead(this.imageProcessingFunction);
    }

    // Grant Rekognition permissions if smart features are enabled
    if (enableSmartCrop || enableContentModeration) {
      const rekognitionPolicy = new iam.PolicyStatement({
        actions: [
          "rekognition:DetectFaces",
          "rekognition:DetectModerationLabels",
        ],
        resources: ["*"],
      });
      this.imageProcessingFunction.addToRolePolicy(rekognitionPolicy);
    }

    // Grant access to fallback image bucket if configured
    if (enableDefaultFallbackImage && fallbackImageS3Bucket) {
      const fallbackImagePolicy = new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${fallbackImageS3Bucket}/*`],
      });
      this.imageProcessingFunction.addToRolePolicy(fallbackImagePolicy);
    }

    // S3 Access Point for original images
    const accessPoint = new s3.CfnAccessPoint(
      this,
      "OriginalImagesAccessPoint",
      {
        bucket: this.originalImagesBucket.bucketName,
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
                `arn:aws:s3:${this.region}:${this.account}:accesspoint/from-cloudfront-ap`,
                `arn:aws:s3:${this.region}:${this.account}:accesspoint/from-cloudfront-ap/object/*`,
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
    this.objectLambdaAccessPoint = new s3ObjectLambda.CfnAccessPoint(
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
                  FunctionArn: this.imageProcessingFunction.functionArn,
                },
              },
            },
          ],
        },
      }
    );

    // Grant S3 Object Lambda permission to invoke the Lambda function
    this.imageProcessingFunction.grantInvoke(
      new iam.ServicePrincipal("s3-object-lambda.amazonaws.com")
    );

    // CloudFront Origin Request Policy
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "ObjectLambdaOriginRequestPolicy",
      {
        originRequestPolicyName: `${this.stackName}-origin-request-policy`,
        comment:
          "Origin request policy for S3 Object Lambda image transformation",
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "Accept",
          "CloudFront-Viewer-Country"
        ),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      }
    );

    // CloudFront Cache Policy
    const cachePolicy = new cloudfront.CachePolicy(
      this,
      "ObjectLambdaCachePolicy",
      {
        cachePolicyName: `${this.stackName}-cache-policy`,
        comment:
          "Cache policy for dynamic image transformation with S3 Object Lambda",
        defaultTtl: cdk.Duration.days(1),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.seconds(0),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Accept"),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      }
    );

    // Origin Access Control (OAC)
    const originAccessControl = new cloudfront.CfnOriginAccessControl(
      this,
      "OriginAccessControl",
      {
        originAccessControlConfig: {
          name: "s3-object-lambda-oac",
          description: "Origin Access Control for S3 Object Lambda",
          originAccessControlOriginType: "s3",
          signingBehavior: "always",
          signingProtocol: "sigv4",
        },
      }
    );

    // CloudFront Distribution
    // Configuring aliases for Object Lambda access points and OAC settings is not possible in L2.
    this.distribution = new cloudfront.CfnDistribution(
      this,
      "ImageCDNDistribution",
      {
        distributionConfig: {
          comment: "Dynamic Image Transformation CDN with S3 Object Lambda",
          enabled: true,
          priceClass: priceClass.toString(),
          defaultCacheBehavior: {
            targetOriginId: "S3ObjectLambdaOrigin",
            viewerProtocolPolicy: "redirect-to-https",
            allowedMethods: ["GET", "HEAD", "OPTIONS"],
            cachedMethods: ["GET", "HEAD", "OPTIONS"],
            cachePolicyId: cachePolicy.cachePolicyId,
            originRequestPolicyId: originRequestPolicy.originRequestPolicyId,
            compress: true,
          },
          origins: [
            {
              id: "S3ObjectLambdaOrigin",
              domainName: `${this.objectLambdaAccessPoint.attrAliasValue}.s3.${this.region}.amazonaws.com`,
              originAccessControlId: originAccessControl.attrId,
              s3OriginConfig: {
                originAccessIdentity: "",
              },
            },
          ],
          logging: {
            bucket: this.logsBucket.bucketDomainName,
            prefix: "cloudfront-logs/",
            includeCookies: false,
          },
          customErrorResponses: [
            {
              errorCode: 500,
              errorCachingMinTtl: 600,
            },
            {
              errorCode: 501,
              errorCachingMinTtl: 600,
            },
            {
              errorCode: 502,
              errorCachingMinTtl: 600,
            },
            {
              errorCode: 503,
              errorCachingMinTtl: 600,
            },
            {
              errorCode: 504,
              errorCachingMinTtl: 600,
            },
          ],
        },
      }
    );

    // S3 Bucket Policy
    new s3.CfnBucketPolicy(this, "BucketPolicy", {
      bucket: this.originalImagesBucket.bucketName,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipalReadOnly",
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: ["s3:GetObject"],
            Resource: `arn:aws:s3:::${this.originalImagesBucket.bucketName}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.ref}`,
              },
            },
          },
          {
            Effect: "Allow",
            Principal: { AWS: "*" },
            Action: ["s3:GetObject"],
            Resource: [
              `arn:aws:s3:::${this.originalImagesBucket.bucketName}`,
              `arn:aws:s3:::${this.originalImagesBucket.bucketName}/*`,
            ],
            Condition: {
              StringEquals: {
                "s3:DataAccessPointAccount": this.account,
              },
            },
          },
        ],
      },
    });

    // Grant CloudFront permission to invoke the Lambda function
    this.imageProcessingFunction.grantInvoke(
      new iam.ServicePrincipal("cloudfront.amazonaws.com")
    );

    // Add specific permission for CloudFront distribution
    this.imageProcessingFunction.addPermission("CloudFrontInvokePermission", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.ref}`,
    });

    // S3 Object Lambda Access Point Policy
    new s3ObjectLambda.CfnAccessPointPolicy(
      this,
      "ObjectLambdaAccessPointPolicy",
      {
        objectLambdaAccessPoint: this.objectLambdaAccessPoint.ref,
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: ["s3-object-lambda:Get*"],
              Resource: `arn:aws:s3-object-lambda:${this.region}:${this.account}:accesspoint/${this.objectLambdaAccessPoint.ref}`,
              Condition: {
                StringEquals: {
                  "aws:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.ref}`,
                },
              },
            },
          ],
        },
      }
    );

    // Deploy demo UI if enabled
    if (deployDemoUi) {
      const demoUiBucket = new s3.Bucket(this, "DemoUiBucket", {
        bucketName: `${this.stackName}-demo-ui-${this.account}`.toLowerCase(),
        websiteIndexDocument: "index.html",
        publicReadAccess: true,
        blockPublicAccess: new s3.BlockPublicAccess({
          blockPublicAcls: false,
          blockPublicPolicy: false,
          ignorePublicAcls: false,
          restrictPublicBuckets: false,
        }),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

      new s3deploy.BucketDeployment(this, "DeployDemoUi", {
        sources: [s3deploy.Source.asset(path.join(__dirname, "../../demo-ui"))],
        destinationBucket: demoUiBucket,
      });

      new cdk.CfnOutput(this, "DemoUiUrl", {
        value: demoUiBucket.bucketWebsiteUrl,
        description: "URL of the demo UI",
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${this.distribution.attrDomainName}`,
      description: "CloudFront distribution URL",
    });

    new cdk.CfnOutput(this, "ImageSourceBucketName", {
      value: this.originalImagesBucket.bucketName,
      description: "Name of the S3 bucket for original images",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.ref,
      description: "CloudFront distribution ID",
    });

    new cdk.CfnOutput(this, "ObjectLambdaAccessPointArn", {
      value: this.objectLambdaAccessPoint.attrArn,
      description: "S3 Object Lambda Access Point ARN",
    });

    new cdk.CfnOutput(this, "ImageProcessingFunctionArn", {
      value: this.imageProcessingFunction.functionArn,
      description: "Image processing Lambda function ARN",
    });
  }
}
