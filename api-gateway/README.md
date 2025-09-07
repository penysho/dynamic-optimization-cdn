# Dynamic Image Transformation with API Gateway

This project implements a dynamic image transformation solution using Amazon API Gateway, Lambda, and CloudFront based on AWS's Dynamic Image Transformation for Amazon CloudFront architecture.

## Architecture Overview

The solution uses the following AWS services:
- **Amazon CloudFront**: CDN for caching transformed images with edge-side request optimization
- **CloudFront Functions**: Lightweight JavaScript functions for request/response modification at the edge
- **Amazon API Gateway**: REST API endpoint for image requests
- **AWS Lambda**: Serverless function for image transformation using Sharp
- **Amazon S3**: Storage for original images and logs
- **AWS Secrets Manager**: (Optional) Stores secrets for signature validation
- **Amazon Rekognition**: (Optional) For smart cropping and content moderation

## Key Features

1. **Dynamic Image Transformation**: Resize, crop, format conversion, quality adjustment
2. **TypeScript Implementation**: Type-safe, maintainable code with comprehensive error handling
3. **CloudFront Function Integration**: Request optimization at the edge for better performance
4. **Auto WebP Conversion**: Automatic WebP format conversion based on Accept headers
5. **Caching**: CloudFront caching with optimized error response handling
6. **Security**: Optional signature validation for request authentication
7. **Smart Features**: Optional smart cropping and content moderation using Amazon Rekognition
8. **Robust Validation**: Comprehensive input validation and sanitization
9. **Structured Logging**: JSON-based structured logging for better observability
10. **Extensibility**: Modular design allows easy addition of new transformation features
11. **Monitoring**: CloudWatch integration for logs and metrics

## API Endpoints

- `GET /{bucket}/{key}?edits={base64-encoded-json}` - Transform image with specified edits
- `GET /{bucket}/{key}?{transformation-params}` - Transform image with query parameters

## Transformation Parameters

- `width`: Target width
- `height`: Target height
- `fit`: Resize fit mode (cover, contain, fill, inside, outside)
- `format`: Output format (jpeg, png, webp, avif, etc.)
- `quality`: Output quality (1-100)
- `rotate`: Rotation angle
- `flip`: Flip horizontally
- `flop`: Flip vertically
- `grayscale`: Convert to grayscale
- `blur`: Blur radius

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18.x or later
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the Sharp layer (required for image processing):
```bash
./build-sharp-layer.sh
```

## Deployment

1. Build the Lambda TypeScript code:
```bash
cd lambda/image-transform
npm install
npm run build
cd ../..
```

2. Build the CDK TypeScript code:
```bash
npm run build
```

3. Deploy the stack:
```bash
npx cdk deploy
```

You can also pass context variables to customize the deployment:
```bash
npx cdk deploy \
  --context deployDemoUi=true \
  --context enableSignature=false \
  --context enableSmartCrop=true
```

### Creating an Image Source Bucket

If you don't have an existing S3 bucket for images, the stack can create one for you:
```bash
npx cdk deploy \
  --context createImageBucket=true \
  --context deploySampleImages=true
```

### Using an Existing S3 Bucket

To use an existing S3 bucket:
```bash
npx cdk deploy \
  --context existingImageBucketName=my-existing-bucket
```

## Configuration Options

- `deployDemoUi`: Deploy a demo UI for testing (default: true)
- `enableSignature`: Enable request signature validation (default: false)
- `enableSmartCrop`: Enable face detection-based smart cropping (default: false)
- `enableContentModeration`: Enable content moderation (default: false)
- `enableAutoWebP`: Enable automatic WebP conversion based on Accept headers (default: false)
- `createImageBucket`: Create a new S3 bucket for image storage (default: false)
- `deploySampleImages`: Deploy sample images to the created bucket (default: false)
- `existingImageBucketName`: Name of existing S3 bucket to use

## Environment Variables

- `ENABLE_SIGNATURE`: Enable request signature validation
- `SECRET_KEY`: AWS Secrets Manager secret name for signature validation
- `IMAGE_BUCKET`: Specific S3 bucket name for image source (if restricted)
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)

## Usage Examples

### Basic Image Transformation

Transform an image using query parameters:
```
https://d123456789.cloudfront.net/my-bucket/images/photo.jpg?width=800&height=600&format=webp&quality=85
```

### Using Edits Format (Serverless Image Handler Compatible)

Create a base64-encoded JSON edits object:
```json
{
  "resize": {
    "width": 800,
    "height": 600,
    "fit": "cover"
  },
  "webp": {
    "quality": 85
  }
}
```

Encode and use in URL:
```
https://d123456789.cloudfront.net/my-bucket/images/photo.jpg?edits=ewogICJyZXNpemUiOiB7CiAgICAid2lkdGgiOiA4MDAsCiAgICAiaGVpZ2h0IjogNjAwLAogICAgImZpdCI6ICJjb3ZlciIKICB9LAogICJ3ZWJwIjogewogICAgInF1YWxpdHkiOiA4NQogIH0KfQ==
```

### Smart Crop Example

Enable face detection-based cropping:
```
https://d123456789.cloudfront.net/my-bucket/images/portrait.jpg?width=400&height=400&smartCrop=true
```

## Architecture Benefits

1. **Cost Optimization**: CloudFront caching reduces Lambda invocations
2. **High Performance**: Low-latency image delivery through CloudFront edge locations
3. **Scalability**: Serverless architecture automatically scales with demand
4. **Security**: Optional request signature validation and content moderation
5. **Flexibility**: Support for multiple image formats and transformation options
6. **Compatibility**: Works with existing S3 buckets without modification

## Monitoring and Troubleshooting

- **CloudWatch Logs**: Lambda function logs are available in CloudWatch
- **CloudFront Logs**: Access logs are stored in the logs S3 bucket
- **API Gateway Metrics**: Monitor API performance and errors
- **X-Ray Tracing**: Enable for detailed request tracing (optional)

## TypeScript Implementation Details

### Architecture Improvements

The Lambda function has been rewritten in TypeScript with the following improvements:

1. **Type Safety**: Comprehensive type definitions for all interfaces and APIs
2. **Modular Design**: Separated concerns into focused classes:
   - `Config`: Environment variable management and validation
   - `Logger`: Structured logging with configurable levels
   - `AWSClients`: Centralized AWS service client management
   - `ImageProcessor`: Image transformation logic using Sharp
   - `RequestParser`: Request parsing and parameter validation
   - `SignatureValidator`: HMAC signature validation
   - `ResponseBuilder`: HTTP response construction
   - `Validators`: Input validation and sanitization

3. **Enhanced Error Handling**:
   - Custom `ImageProcessingError` class with proper status codes
   - Comprehensive AWS error mapping
   - Graceful error recovery where appropriate

4. **Robust Validation**:
   - Input sanitization to prevent XSS attacks
   - Parameter range validation
   - S3 bucket and object key validation
   - Image format validation

5. **Improved Security**:
   - Constant-time signature comparison
   - Comprehensive security headers
   - Input sanitization and validation

6. **Better Observability**:
   - Structured JSON logging
   - Configurable log levels
   - Performance metrics and timing
   - Detailed error context

### Development Workflow

1. TypeScript source files are in `lambda/image-transform/src/`
2. Build generates JavaScript in `lambda/image-transform/dist/`
3. CDK bundles the dist folder for Lambda deployment
4. Source maps are included for debugging

## Cleanup

To remove the stack and all resources:
```bash
npx cdk destroy
```
