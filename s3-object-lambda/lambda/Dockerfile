# https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/python-image.html

# Use the official AWS Lambda Python 3.12 base image
FROM public.ecr.aws/lambda/python:3.12 AS builder

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./

# Create virtual environment and install dependencies
RUN uv venv .venv && \
    . .venv/bin/activate && \
    uv sync --frozen --no-dev

# Production stage
FROM public.ecr.aws/lambda/python:3.12

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy virtual environment from builder stage
COPY --from=builder ${LAMBDA_TASK_ROOT}/.venv/lib/python3.12/site-packages/ ${LAMBDA_RUNTIME_DIR}/

# Copy Python source files
COPY *.py ./

# Set the handler for Lambda container runtime
# Standard format: filename.functionname
CMD ["index.lambda_handler"]

# Labels for better container management
LABEL maintainer="dynamic-optimization-cdn"
LABEL version="1.0.0"
LABEL description="Lambda function for S3 Object Lambda image processing with PIL"
