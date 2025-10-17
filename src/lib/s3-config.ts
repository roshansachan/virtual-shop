import { S3Client } from '@aws-sdk/client-s3';

// Initialize S3 client
export function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// Get AWS bucket name
export function getAWSBucketName(): string {
  return process.env.AWS_BUCKET_NAME || '';
}

// Get AWS region
export function getAWSRegion(): string {
  return process.env.AWS_REGION || '';
}

// Generate S3 URL from key
export function getS3Url(key: string): string {
  const bucketName = getAWSBucketName();
  const region = getAWSRegion();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

// Generate S3 key for general uploads
export function generateS3Key(sceneId: string, placementId: string, filename: string): string {
  const timestamp = Date.now();
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `scenes/${sceneId}/folders/${placementId}/${timestamp}_${cleanFilename}`;
}

// Generate S3 key for scene background uploads
export function generateSceneBackgroundS3Key(sceneId: string, filename: string): string {
  const timestamp = Date.now();
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `scenes/${sceneId}/backgrounds/${timestamp}_${cleanFilename}`;
}
