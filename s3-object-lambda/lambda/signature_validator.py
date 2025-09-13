"""URL signature validation for S3 Object Lambda image processing."""

import hashlib
import hmac
import time
from urllib.parse import parse_qs, urlparse

from aws_clients import AWSClients
from config import Config
from logger import get_logger
from models import ImageProcessingError

logger = get_logger(__name__)


class SignatureValidator:
    """URL signature validation utilities."""

    def __init__(self, config: Config, aws_clients: AWSClients):
        """Initialize signature validator.

        Args:
            config: Application configuration
            aws_clients: AWS clients manager
        """
        self.config = config
        self.aws_clients = aws_clients
        self._secret_cache: str | None = None
        self._secret_cache_time: float | None = None
        self._secret_cache_ttl = 300  # 5 minutes

    def _get_secret(self) -> str:
        """Get signing secret with caching.

        Returns:
            Signing secret

        Raises:
            ImageProcessingError: If secret retrieval fails
        """
        current_time = time.time()

        # Check if we have a valid cached secret
        if (
            self._secret_cache
            and self._secret_cache_time
            and (current_time - self._secret_cache_time) < self._secret_cache_ttl
        ):
            return self._secret_cache

        try:
            if not self.config.secret_name:
                raise ImageProcessingError("Secret name not configured", 500)

            logger.debug(
                "Retrieving signing secret", secret_name=self.config.secret_name
            )

            # Try to get the secret as a JSON object with a key first
            try:
                secret = self.aws_clients.get_secret_value(
                    self.config.secret_name, "signing_key"
                )
            except Exception:
                # Fallback to plain text secret
                secret = self.aws_clients.get_secret_value(self.config.secret_name)

            # Cache the secret
            self._secret_cache = secret
            self._secret_cache_time = current_time

            logger.debug("Signing secret retrieved and cached")
            return secret

        except Exception as e:
            logger.error("Failed to retrieve signing secret", error=str(e))
            raise ImageProcessingError("Failed to retrieve signing secret", 500) from e

    def validate_signature(self, url: str) -> None:
        """Validate URL signature.

        Args:
            url: URL to validate

        Raises:
            ImageProcessingError: If signature is invalid or missing
        """
        if not self.config.is_signature_enabled:
            logger.debug("Signature validation disabled")
            return

        logger.debug("Validating URL signature", url=url)

        try:
            parsed_url = urlparse(url)
            query_params = parse_qs(parsed_url.query)

            # Extract signature and expiry
            signature = query_params.get("signature", [None])[0]
            expires = query_params.get("expires", [None])[0]

            if not signature:
                raise ImageProcessingError("Missing signature parameter", 403)

            if not expires:
                raise ImageProcessingError("Missing expires parameter", 403)

            # Check expiry
            try:
                expires_timestamp = int(expires)
                current_timestamp = int(time.time())

                if current_timestamp > expires_timestamp:
                    raise ImageProcessingError("Signature has expired", 403)

            except ValueError:
                raise ImageProcessingError("Invalid expires parameter", 400)

            # Create string to sign (URL without signature parameter)
            query_without_signature = "&".join(
                [
                    f"{key}={value[0]}"
                    for key, value in query_params.items()
                    if key != "signature"
                ]
            )

            string_to_sign = f"{parsed_url.path}?{query_without_signature}"

            # Calculate expected signature
            secret = self._get_secret()
            expected_signature = hmac.new(
                secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256
            ).hexdigest()

            # Compare signatures
            if not hmac.compare_digest(signature, expected_signature):
                logger.warning(
                    "Signature validation failed",
                    url=url,
                    expected_signature=expected_signature[:8]
                    + "...",  # Log only first 8 chars
                    provided_signature=signature[:8] + "...",
                )
                raise ImageProcessingError("Invalid signature", 403)

            logger.debug("Signature validation successful")

        except ImageProcessingError:
            raise
        except Exception as e:
            logger.error("Signature validation error", error=str(e), url=url)
            raise ImageProcessingError("Signature validation failed", 500) from e

    @staticmethod
    def generate_signature(url: str, secret: str, expires: int) -> str:
        """Generate URL signature for testing purposes.

        Args:
            url: URL to sign
            secret: Signing secret
            expires: Expiry timestamp

        Returns:
            Generated signature
        """
        parsed_url = urlparse(url)
        query_params = parse_qs(parsed_url.query)

        # Add expires parameter
        query_params["expires"] = [str(expires)]

        # Create string to sign
        query_string = "&".join(
            [f"{key}={value[0]}" for key, value in query_params.items()]
        )

        string_to_sign = f"{parsed_url.path}?{query_string}"

        # Calculate signature
        signature = hmac.new(
            secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        return signature
