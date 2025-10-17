/**
 * Utility functions for handling image URLs and CORS issues
 */

// Check if a URL is an S3 URL
export function isS3Url(url: string): boolean {
  return url.includes('s3.') && url.includes('amazonaws.com');
}

// Get a proxied image URL for CORS issues
export function getProxiedImageUrl(originalUrl: string): string {
  if (!isS3Url(originalUrl)) {
    return originalUrl;
  }
  
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

// Get the best image URL to use (direct or proxied)
export function getBestImageUrl(originalUrl: string, useProxy: boolean = false): string {
  if (!isS3Url(originalUrl) || !useProxy) {
    return originalUrl;
  }
  
  return getProxiedImageUrl(originalUrl);
}