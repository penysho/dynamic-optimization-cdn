"""AWS client management for S3 Object Lambda image processing."""

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from .config import Config
from .logger import get_logger
from .types import AWSError

logger = get_logger(__name__)


class AWSClients:
    """AWS client manager with error handling and retry logic."""

    def __init__(self, config: Config):
        """Initialize AWS clients.

        Args:
            config: Application configuration
        """
        self.config = config
        self._s3_client: boto3.client | None = None
        self._secrets_manager_client: boto3.client | None = None
        self._rekognition_client: boto3.client | None = None

    @property
    def s3(self) -> boto3.client:
        """Get S3 client with lazy initialization."""
        if self._s3_client is None:
            try:
                self._s3_client = boto3.client("s3", region_name=self.config.aws_region)
                logger.debug("S3 client initialized", region=self.config.aws_region)
            except NoCredentialsError as e:
                logger.error(
                    "Failed to initialize S3 client: No credentials", error=str(e)
                )
                raise AWSError(
                    "AWS credentials not found", "NoCredentialsError", 500
                ) from e
            except Exception as e:
                logger.error("Failed to initialize S3 client", error=str(e))
                raise AWSError(
                    "Failed to initialize S3 client", "ClientInitializationError", 500
                ) from e

        return self._s3_client

    @property
    def secrets_manager(self) -> boto3.client:
        """Get Secrets Manager client with lazy initialization."""
        if self._secrets_manager_client is None:
            try:
                self._secrets_manager_client = boto3.client(
                    "secretsmanager", region_name=self.config.aws_region
                )
                logger.debug(
                    "Secrets Manager client initialized", region=self.config.aws_region
                )
            except NoCredentialsError as e:
                logger.error(
                    "Failed to initialize Secrets Manager client: No credentials",
                    error=str(e),
                )
                raise AWSError(
                    "AWS credentials not found", "NoCredentialsError", 500
                ) from e
            except Exception as e:
                logger.error(
                    "Failed to initialize Secrets Manager client", error=str(e)
                )
                raise AWSError(
                    "Failed to initialize Secrets Manager client",
                    "ClientInitializationError",
                    500,
                ) from e

        return self._secrets_manager_client

    @property
    def rekognition(self) -> boto3.client:
        """Get Rekognition client with lazy initialization."""
        if self._rekognition_client is None:
            try:
                self._rekognition_client = boto3.client(
                    "rekognition", region_name=self.config.aws_region
                )
                logger.debug(
                    "Rekognition client initialized", region=self.config.aws_region
                )
            except NoCredentialsError as e:
                logger.error(
                    "Failed to initialize Rekognition client: No credentials",
                    error=str(e),
                )
                raise AWSError(
                    "AWS credentials not found", "NoCredentialsError", 500
                ) from e
            except Exception as e:
                logger.error("Failed to initialize Rekognition client", error=str(e))
                raise AWSError(
                    "Failed to initialize Rekognition client",
                    "ClientInitializationError",
                    500,
                ) from e

        return self._rekognition_client

    def get_secret_value(self, secret_name: str, key: str | None = None) -> str:
        """Get secret value from AWS Secrets Manager.

        Args:
            secret_name: Name of the secret
            key: Optional key within the secret (for JSON secrets)

        Returns:
            Secret value

        Raises:
            AWSError: If secret retrieval fails
        """
        try:
            logger.debug("Retrieving secret", secret_name=secret_name, key=key)

            response = self.secrets_manager.get_secret_value(SecretId=secret_name)
            secret_string = response["SecretString"]

            if key:
                import json  # noqa: PLC0415

                secret_dict = json.loads(secret_string)
                if key not in secret_dict:
                    raise AWSError(
                        f"Key '{key}' not found in secret", "KeyNotFound", 404
                    )
                return secret_dict[key]

            return secret_string

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            error_message = e.response["Error"]["Message"]

            logger.error(
                "Failed to retrieve secret",
                secret_name=secret_name,
                error_code=error_code,
                error_message=error_message,
            )

            if error_code == "ResourceNotFoundException":
                raise AWSError(
                    f"Secret '{secret_name}' not found", error_code, 404
                ) from e
            elif error_code == "InvalidParameterException":
                raise AWSError(
                    f"Invalid parameter for secret '{secret_name}'", error_code, 400
                ) from e
            elif error_code == "InvalidRequestException":
                raise AWSError(
                    f"Invalid request for secret '{secret_name}'", error_code, 400
                ) from e
            elif error_code == "DecryptionFailureException":
                raise AWSError(
                    f"Failed to decrypt secret '{secret_name}'", error_code, 500
                ) from e
            else:
                raise AWSError(
                    f"Failed to retrieve secret '{secret_name}': {error_message}",
                    error_code,
                    500,
                ) from e

        except Exception as e:
            logger.error(
                "Unexpected error retrieving secret",
                secret_name=secret_name,
                error=str(e),
            )
            raise AWSError(
                f"Unexpected error retrieving secret: {e}", "UnexpectedError", 500
            ) from e

    def write_get_object_response(
        self,
        request_route: str,
        request_token: str,
        body: bytes,
        content_type: str,
        status_code: int = 200,
    ) -> None:
        """Write response to S3 Object Lambda.

        Args:
            request_route: Request route from event
            request_token: Request token from event
            body: Response body
            content_type: Content type
            status_code: HTTP status code

        Raises:
            AWSError: If write operation fails
        """
        try:
            logger.debug(
                "Writing S3 Object Lambda response",
                content_type=content_type,
                body_size=len(body),
                status_code=status_code,
            )

            response_args = {
                "RequestRoute": request_route,
                "RequestToken": request_token,
                "Body": body,
                "ContentType": content_type,
            }

            # Only add StatusCode if it's not 200 (default)
            if status_code != 200:
                response_args["StatusCode"] = status_code

            self.s3.write_get_object_response(**response_args)

            logger.info(
                "S3 Object Lambda response written successfully",
                content_type=content_type,
                body_size=len(body),
                status_code=status_code,
            )

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            error_message = e.response["Error"]["Message"]

            logger.error(
                "Failed to write S3 Object Lambda response",
                error_code=error_code,
                error_message=error_message,
            )

            raise AWSError(
                f"Failed to write response: {error_message}", error_code, 500
            ) from e

        except Exception as e:
            logger.error(
                "Unexpected error writing S3 Object Lambda response", error=str(e)
            )
            raise AWSError(
                f"Unexpected error writing response: {e}", "UnexpectedError", 500
            ) from e
