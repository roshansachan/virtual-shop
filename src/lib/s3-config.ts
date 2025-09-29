import { S3Client } from '@aws-sdk/client-s3';

// Initialize S3 client
export function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// Get AWS bucket name
export function getAWSBucketName(): string {
  return process.env.AWS_BUCKET_NAME || 'o1-virtual-shop';
}

// Generate S3 URL from key
export function getS3Url(key: string): string {
  const bucketName = getAWSBucketName();
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}
