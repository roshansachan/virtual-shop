// Shared S3 utilities that work on both client and server

// Generate S3 URL from key - works in both environments
export function generateS3Url(key: string): string {
  // Try to get environment variables, with fallbacks for client-side
  const bucketName = 
    (typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_AWS_BUCKET_NAME 
      : process.env.AWS_BUCKET_NAME);
      
  const region = 
    (typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_AWS_REGION 
      : process.env.AWS_REGION);
      
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

// Generate CDN URL from key - uses CDN_ENDPOINT_URL if available
export function generateCdnUrl(key: string): string {
  // Try to get CDN endpoint URL, fallback to S3 URL if not available
  const cdnEndpoint = 
    (typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_CDN_ENDPOINT_URL 
      : process.env.CDN_ENDPOINT_URL);
      
  if (cdnEndpoint) {
    // Ensure the CDN endpoint ends with a slash
    const normalizedEndpoint = cdnEndpoint.endsWith('/') ? cdnEndpoint : `${cdnEndpoint}/`;
    return `${normalizedEndpoint}${key}`;
  }
  
  // Fallback to S3 URL if CDN endpoint is not configured
  return generateS3Url(key);
}

// Convert S3 URL to CDN URL by replacing the domain
export function s3UrlToCdnUrl(s3Url: string): string {
  if (!isS3Url(s3Url)) {
    return s3Url; // Return as-is if not an S3 URL
  }
  
  const cdnEndpoint = 
    (typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_CDN_ENDPOINT_URL 
      : process.env.CDN_ENDPOINT_URL);
      
  if (!cdnEndpoint) {
    return s3Url; // Return S3 URL if CDN endpoint is not configured
  }
  
  // Extract the key from S3 URL
  const key = s3UrlToKey(s3Url);
  if (!key) {
    return s3Url; // Return as-is if key extraction fails
  }
  
  return generateCdnUrl(key);
}

// Convert S3 key to URL, handling null/undefined values
export function s3KeyToUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return generateCdnUrl(key);
}

// Convert S3 URL back to key (useful for migration)
export function s3UrlToKey(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Common S3 URL patterns to match
  const patterns = [
    /^https:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)$/,
    /^https:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)$/,
    /^https:\/\/([^\/]+)\/(.+)$/ // Generic pattern for custom endpoints
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[match.length - 1]; // Return the last capture group (the key)
    }
  }
  
  // If no patterns match, assume it's already a key
  return url;
}

// Check if a string is an S3 URL or a key
export function isS3Url(str: string): boolean {
  return str.startsWith('https://') && str.includes('.s3.');
}