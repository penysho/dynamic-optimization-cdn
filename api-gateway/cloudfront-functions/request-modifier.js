// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * CloudFront Function to modify viewer requests for image transformation
 * - Normalizes Accept header for WebP detection
 * - Filters and sorts query parameters
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
  const ALLOWED_PARAMS = [
    "signature",
    "expires",
    "format",
    "fit",
    "width",
    "height",
    "rotate",
    "flip",
    "flop",
    "grayscale",
    "quality",
    "blur",
    "smartCrop",
  ];

  let qs = [];
  for (const key in querystring) {
    if (!ALLOWED_PARAMS.includes(key)) {
      continue;
    }
    const value = querystring[key];
    qs.push(
      value.multiValue
        ? `${key}=${value.multiValue[value.multiValue.length - 1].value}`
        : `${key}=${value.value}`
    );
  }

  // Sort parameters for consistent cache keys
  return qs.sort();
}
