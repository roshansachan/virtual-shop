#!/usr/bin/env node

/**
 * Script to configure CORS for S3 bucket
 * Run with: node scripts/setup-s3-cors.js
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_BUCKET_NAME;

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://virtual-shop-hazel.vercel.app', // Replace with your production domain
      ],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    },
  ],
};

async function setupCORS() {
  try {
    console.log(`Setting up CORS for bucket: ${bucketName}`);
    
    // Set CORS configuration
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration,
    });
    
    await s3Client.send(command);
    console.log('✅ CORS configuration applied successfully!');
    
    // Verify CORS configuration
    const getCorsCommand = new GetBucketCorsCommand({
      Bucket: bucketName,
    });
    
    const corsResult = await s3Client.send(getCorsCommand);
    console.log('📋 Current CORS configuration:');
    console.log(JSON.stringify(corsResult.CORSRules, null, 2));
    
  } catch (error) {
    console.error('❌ Error setting up CORS:', error);
    if (error.name === 'NoSuchBucket') {
      console.error(`Bucket "${bucketName}" does not exist.`);
    } else if (error.name === 'AccessDenied') {
      console.error('Access denied. Check your AWS credentials and permissions.');
    }
  }
}

if (require.main === module) {
  setupCORS();
}

module.exports = { setupCORS };