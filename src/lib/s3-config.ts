import { S3Client } from '@aws-sdk/client-s3';

// Function to safely get environment variables
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Environment variable ${name} is not set`);
    console.log('Available env vars:', Object.keys(process.env).filter(key => key.startsWith('AWS')));
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// Function to get S3 client instance (lazy initialization)
export function getS3Client(): S3Client {
  console.log('Creating S3 Client...');
  console.log('Environment check:');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
  console.log('AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME || 'NOT SET');
  console.log('AWS_REGION:', process.env.AWS_REGION || 'NOT SET');

  const AWS_ACCESS_KEY_ID = getEnvVar('AWS_ACCESS_KEY_ID');
  const AWS_SECRET_ACCESS_KEY = getEnvVar('AWS_SECRET_ACCESS_KEY');
  
  return new S3Client({
    region: getEnvVar('AWS_REGION'),
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Export functions to get configuration values
export function getAWSBucketName(): string {
  return getEnvVar('AWS_BUCKET_NAME');
}

export function getAWSRegion(): string {
  return getEnvVar('AWS_REGION');
}

// For backward compatibility - define these as getters that will be called when accessed
Object.defineProperty(exports, 's3Client', {
  get: () => getS3Client(),
  enumerable: true,
});

Object.defineProperty(exports, 'AWS_BUCKET_NAME', {
  get: () => getAWSBucketName(),
  enumerable: true,
});

Object.defineProperty(exports, 'AWS_REGION', {
  get: () => getAWSRegion(),
  enumerable: true,
});

// Generate S3 key for organizing files
export function generateS3Key(sceneId: string, folderId: string, filename: string): string {
  const timestamp = Date.now();
  const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  return `scenes/${sceneId}/products/${folderId}/${timestamp}-${filename}`;
}

// Generate S3 key for scene background images
export function generateSceneBackgroundS3Key(sceneId: string, filename: string): string {
  const timestamp = Date.now();
  const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  return `scenes/${sceneId}/backgrounds/${timestamp}-${filename}`;
}

// Generate public S3 URL
export function getS3Url(key: string): string {
  const bucketName = getAWSBucketName();
  const region = getAWSRegion();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}