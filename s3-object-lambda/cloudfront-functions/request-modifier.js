// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * CloudFront Function to modify viewer requests for image transformation
 * - Normalizes Accept header for WebP detection
 * - Filters and sorts query parameters
 * - Validates quality profile and format parameters at edge
 * - Supports optimized quality system with profile-based settings
 */
function handler(event) {
  // Normalize accept header to only include values used on the backend
  if (
    event.request.headers &&
    event.request.headers.accept &&
    event.request.headers.accept.value
  ) {
    event.request.headers.accept.value =
      event.request.headers.accept.value.indexOf("image/webp") > -1
        ? "image/webp"
        : "";
  }

  // Process and normalize query parameters
  event.request.querystring = processQueryParams(
    event.request.querystring
  ).join("&");

  return event.request;
}

/**
 * Process query parameters to only allow specific parameters and sort them
 * @param {Object} querystring - Original query string parameters
 * @returns {Array} - Array of processed query string parameters
 */
function processQueryParams(querystring) {
  if (querystring == null) {
    return [];
  }

  // Define allowed query parameters for image transformation
  // Using full parameter names for compatibility with API Gateway pattern
  const ALLOWED_PARAMS = [
    "signature",
    "expires",
    "width",
    "height",
    "quality",
    "profile", // NEW: Quality profile parameter
    "format",
    "fit",
    "rotate",
    "flip",
    "flop",
    "grayscale",
    "blur",
    "smartCrop",
  ];

  // Valid values for specific parameters
  // Quality profiles determine format-specific quality settings:
  // - high: For photos/artwork (JPEG:90, WebP:85, AVIF:70)
  // - standard: Balanced quality/size (JPEG:85, WebP:80, AVIF:60)
  // - optimized: Fast delivery (JPEG:75, WebP:70, AVIF:50)
  const VALID_PROFILES = ["high", "standard", "optimized"];
  const VALID_FORMATS = ["jpeg", "jpg", "png", "webp", "avif"];
  const VALID_FIT_VALUES = ["contain", "cover", "fill", "inside", "outside"];

  let qs = [];
  for (const key in querystring) {
    if (!ALLOWED_PARAMS.includes(key)) {
      continue;
    }

    const value = querystring[key];
    const paramValue = value.multiValue
      ? value.multiValue[value.multiValue.length - 1].value
      : value.value;

    // Validate specific parameter values at edge
    if (
      key === "profile" &&
      !VALID_PROFILES.includes(paramValue.toLowerCase())
    ) {
      continue; // Skip invalid profile values
    }
    if (key === "format" && !VALID_FORMATS.includes(paramValue.toLowerCase())) {
      continue; // Skip invalid format values
    }
    if (key === "fit" && !VALID_FIT_VALUES.includes(paramValue.toLowerCase())) {
      continue; // Skip invalid fit values
    }

    qs.push(`${key}=${paramValue}`);
  }

  // Sort parameters for consistent cache keys
  return qs.sort();
}
