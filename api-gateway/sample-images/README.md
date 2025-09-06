# Sample Images

This directory is used to store sample images that can be deployed to the created S3 bucket when `deploySampleImages` is set to `true`.

## Adding Sample Images

To add sample images:
1. Place your image files (JPEG, PNG, WebP, etc.) in this directory
2. Set `deploySampleImages=true` when deploying the stack
3. The images will be uploaded to the S3 bucket under the `samples/` prefix

## Example Usage

After deployment, sample images can be accessed via:
```
https://your-cloudfront-url.com/your-bucket-name/samples/sample-image.jpg
```

## Supported Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- AVIF (.avif)
- GIF (.gif)
- TIFF (.tif, .tiff)
- SVG (.svg)
