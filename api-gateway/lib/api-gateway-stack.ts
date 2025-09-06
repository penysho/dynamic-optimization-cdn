import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as path from "path";

export interface ApiGatewayStackProps extends cdk.StackProps {
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
   * Create image source S3 bucket
   * @default false
   */
  createImageBucket?: boolean;

  /**
   * Deploy sample images to the created bucket
   * @default false
   */
  deploySampleImages?: boolean;

  /**
   * Existing image bucket name (used when createImageBucket is false)
   * @default undefined
   */
  existingImageBucketName?: string;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly apiEndpoint: apigateway.RestApi;
  public readonly imageTransformFunction: lambda.Function;
  public readonly logsBucket: s3.Bucket;
  public readonly imageBucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props?: ApiGatewayStackProps) {
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
      createImageBucket = false,
      deploySampleImages = false,
      existingImageBucketName,
    } = props || {};

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

    // Create or reference image source bucket
    let imageBucketName: string | undefined;
    if (createImageBucket) {
      this.imageBucket = new s3.Bucket(this, "ImageSourceBucket", {
        bucketName: `${this.stackName}-img-${this.account}`.toLowerCase(),
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        cors: [
          {
            allowedHeaders: ["*"],
            allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
            allowedOrigins: ["*"],
            maxAge: 3000,
          },
        ],
      });
      imageBucketName = this.imageBucket.bucketName;

      // Deploy sample images if requested
      if (deploySampleImages) {
        new s3deploy.BucketDeployment(this, "DeploySampleImages", {
          sources: [
            s3deploy.Source.asset(path.join(__dirname, "../sample-images")),
          ],
          destinationBucket: this.imageBucket,
          destinationKeyPrefix: "samples/",
        });
      }
    } else if (existingImageBucketName) {
      imageBucketName = existingImageBucketName;
    }

    // Create Lambda layer for Sharp
    const sharpLayer = new lambda.LayerVersion(this, "SharpLayer", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda-layers/sharp-layer")
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: "Sharp image processing library",
    });

    // Create Lambda function for image transformation
    this.imageTransformFunction = new lambda.Function(
      this,
      "ImageTransformFunction",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/image-transform")
        ),
        memorySize: lambdaMemorySize,
        timeout: cdk.Duration.seconds(Math.min(lambdaTimeout, 29)),
        layers: [sharpLayer],
        environment: {
          ENABLE_SIGNATURE: enableSignature.toString(),
          SECRET_NAME: secretName || "",
          IMAGE_BUCKET: imageBucketName || "",
          ENABLE_SMART_CROP: enableSmartCrop.toString(),
          ENABLE_CONTENT_MODERATION: enableContentModeration.toString(),
          AUTO_WEBP: enableAutoWebP.toString(),
          LOG_LEVEL: "INFO",
        },
        logGroup: new logs.LogGroup(this, "ImageTransformFunctionLogGroup", {
          logGroupName: `/aws/lambda/${this.stackName}-ImageTransformFunction`,
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }
    );

    // Grant S3 read permissions
    if (imageBucketName) {
      // Grant permission to specific bucket
      const s3Policy = new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${imageBucketName}/*`],
      });
      this.imageTransformFunction.addToRolePolicy(s3Policy);
    } else {
      // If no bucket specified, grant permission to all buckets
      const s3Policy = new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: ["arn:aws:s3:::*/*"],
      });
      this.imageTransformFunction.addToRolePolicy(s3Policy);
    }

    // Grant additional read permissions to the created image bucket
    if (this.imageBucket) {
      this.imageBucket.grantRead(this.imageTransformFunction);
    }

    // Grant Secrets Manager read permissions if signature is enabled
    if (enableSignature && secretName) {
      const secret = secretsmanager.Secret.fromSecretNameV2(
        this,
        "SignatureSecret",
        secretName
      );
      secret.grantRead(this.imageTransformFunction);
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
      this.imageTransformFunction.addToRolePolicy(rekognitionPolicy);
    }

    // Create API Gateway
    this.apiEndpoint = new apigateway.RestApi(this, "ImageTransformApi", {
      restApiName: `${this.stackName}-api`,
      description: "API for dynamic image transformation",
      deployOptions: {
        stageName: "prod",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      binaryMediaTypes: ["*/*"],
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.imageTransformFunction,
      {
        proxy: true,
      }
    );

    // Add resource and method for /{bucket}/{key+}
    const bucketResource = this.apiEndpoint.root.addResource("{bucket}");
    const keyResource = bucketResource.addResource("{key+}");

    keyResource.addMethod("GET", lambdaIntegration);

    // Create CloudFront Function for request modification
    const requestModifierFunction = new cloudfront.Function(
      this,
      "RequestModifierFunction",
      {
        functionName: `${this.stackName}-request-modifier`,
        comment: "Modifies viewer requests for image transformation",
        code: cloudfront.FunctionCode.fromFile({
          filePath: path.join(
            __dirname,
            "../cloudfront-functions/request-modifier.js"
          ),
        }),
        runtime: cloudfront.FunctionRuntime.JS_2_0,
      }
    );

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(
      this,
      "ImageTransformDistribution",
      {
        defaultBehavior: {
          origin: new origins.RestApiOrigin(this.apiEndpoint),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, "ImageCachePolicy", {
            cachePolicyName: `${this.stackName}-cache-policy`,
            comment: "Cache policy for image transformation",
            defaultTtl: cdk.Duration.days(1),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Accept"),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          }),
          originRequestPolicy: new cloudfront.OriginRequestPolicy(
            this,
            "ImageOriginRequestPolicy",
            {
              originRequestPolicyName: `${this.stackName}-origin-request-policy`,
              comment: "Origin request policy for image transformation",
              queryStringBehavior:
                cloudfront.OriginRequestQueryStringBehavior.all(),
              headerBehavior:
                cloudfront.OriginRequestHeaderBehavior.allowList("Accept"),
              cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
            }
          ),
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: requestModifierFunction,
            },
          ],
        },
        priceClass,
        logBucket: this.logsBucket,
        logFilePrefix: "cloudfront-logs/",
        comment: "CloudFront distribution for dynamic image transformation",
        errorResponses: [
          {
            httpStatus: 500,
            ttl: cdk.Duration.seconds(600),
          },
          {
            httpStatus: 501,
            ttl: cdk.Duration.seconds(600),
          },
          {
            httpStatus: 502,
            ttl: cdk.Duration.seconds(600),
          },
          {
            httpStatus: 503,
            ttl: cdk.Duration.seconds(600),
          },
          {
            httpStatus: 504,
            ttl: cdk.Duration.seconds(600),
          },
        ],
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
        sources: [s3deploy.Source.asset(path.join(__dirname, "../demo-ui"))],
        destinationBucket: demoUiBucket,
      });

      new cdk.CfnOutput(this, "DemoUiUrl", {
        value: demoUiBucket.bucketWebsiteUrl,
        description: "URL of the demo UI",
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      description: "CloudFront distribution URL",
    });

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: this.apiEndpoint.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "ImageTransformFunctionArn", {
      value: this.imageTransformFunction.functionArn,
      description: "Image transformation Lambda function ARN",
    });

    // Output image bucket name if created
    if (this.imageBucket) {
      new cdk.CfnOutput(this, "ImageSourceBucketName", {
        value: this.imageBucket.bucketName,
        description: "Created image source S3 bucket name",
      });
    } else if (existingImageBucketName) {
      new cdk.CfnOutput(this, "ImageSourceBucketName", {
        value: existingImageBucketName,
        description: "Existing image source S3 bucket name",
      });
    }
  }
}
