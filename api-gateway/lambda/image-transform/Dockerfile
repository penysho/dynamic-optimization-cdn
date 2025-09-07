# https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/typescript-image.html

# Use the official AWS Lambda Node.js 18 base image
FROM public.ecr.aws/lambda/nodejs:18 AS builder

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm i

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM public.ecr.aws/lambda/nodejs:18

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package.json and package-lock.json for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm i --omit=dev

# Copy built files from builder stage to correct location
COPY --from=builder ${LAMBDA_TASK_ROOT}/dist/index.js ${LAMBDA_TASK_ROOT}/

# Set the handler for Lambda container runtime
# Standard format: filename.functionname
CMD ["index.handler"]

# Labels for better container management
LABEL maintainer="dynamic-optimization-cdn"
LABEL version="1.0.0"
LABEL description="Lambda function for dynamic image transformation with Sharp"
