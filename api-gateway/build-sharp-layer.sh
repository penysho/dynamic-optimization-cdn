#!/bin/bash

# Build Sharp layer for Lambda
echo "Building Sharp layer for Lambda..."

cd lambda-layers/sharp-layer/nodejs

# Install dependencies
npm install --arch=x64 --platform=linux sharp

# Clean up unnecessary files
rm -rf node_modules/sharp/docs
rm -rf node_modules/sharp/src
rm -rf node_modules/sharp/vendor

cd ../../..

echo "Sharp layer build complete!"
