import { getS3Client, getAWSBucketName, getAWSRegion } from '@/lib/s3-config';

export async function GET() {
  try {
    console.log('Testing S3 configuration...');
    
    // Test getting the configuration values
    const bucketName = getAWSBucketName();
    const region = getAWSRegion();
    const s3Client = getS3Client();
    
    console.log('S3 Configuration loaded successfully:');
    console.log('Bucket:', bucketName);
    console.log('Region:', region);
    console.log('S3 Client created:', !!s3Client);
    
    return Response.json({
      success: true,
      config: {
        bucketName,
        region,
        s3ClientCreated: !!s3Client,
      }
    });
  } catch (error) {
    console.error('S3 configuration error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}