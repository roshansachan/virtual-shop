import { NextRequest, NextResponse } from 'next/server';
import { getAWSBucketName, getAWSRegion } from '@/lib/s3-config';

export async function GET(request: NextRequest) {
  console.log('Testing environment variables...');
  
  try {
    // Test if we can get the AWS config
    const bucketName = getAWSBucketName();
    const region = getAWSRegion();
    
    const envVars = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
      AWS_BUCKET_NAME: bucketName,
      AWS_REGION: region,
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    };

    console.log('Environment variables:', envVars);
    console.log('All AWS env vars:', Object.keys(process.env).filter(key => key.startsWith('AWS')));

    return NextResponse.json({
      success: true,
      environment: envVars,
      allAwsVars: Object.keys(process.env).filter(key => key.startsWith('AWS')),
    });
  } catch (error) {
    console.error('Error getting environment variables:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || 'NOT SET',
        AWS_REGION: process.env.AWS_REGION || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      },
      allAwsVars: Object.keys(process.env).filter(key => key.startsWith('AWS')),
    }, { status: 500 });
  }
}