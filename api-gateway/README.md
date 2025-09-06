# Dynamic Image Transformation with API Gateway

This project implements a dynamic image transformation solution using Amazon API Gateway, Lambda, and CloudFront based on AWS's Dynamic Image Transformation for Amazon CloudFront architecture.

## Architecture Overview

The solution uses the following AWS services:
- **Amazon CloudFront**: CDN for caching transformed images
- **Amazon API Gateway**: REST API endpoint for image requests
- **AWS Lambda**: Serverless function for image transformation using Sharp
- **Amazon S3**: Storage for original images and logs
- **AWS Secrets Manager**: (Optional) Stores secrets for signature validation
- **Amazon Rekognition**: (Optional) For smart cropping and content moderation

## Key Features

1. **Dynamic Image Transformation**: Resize, crop, format conversion, quality adjustment
2. **Caching**: CloudFront caching reduces processing costs and latency
3. **Security**: Optional signature validation for request authentication
4. **Extensibility**: Modular design allows easy addition of new transformation features
5. **Monitoring**: CloudWatch integration for logs and metrics

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

1. Build the TypeScript code:
```bash
npm run build
```

2. Deploy the stack:
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

## Cleanup

To remove the stack and all resources:
```bash
npx cdk destroy
```
