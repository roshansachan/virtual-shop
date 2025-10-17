#!/usr/bin/env node

/**
 * Script to download all objects from S3 bucket to local directory
 * Creates a directory with the bucket name and preserves S3 key structure
 * Run with: node scripts/download-s3-bucket.js
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_BUCKET_NAME || 'o1-virtual-shop';

async function downloadFromS3() {
  try {
    console.log(`Starting download from bucket: ${bucketName}`);

    // Create local directory with bucket name
    const localDir = path.join(process.cwd(), bucketName);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
      console.log(`Created directory: ${localDir}`);
    }

    let continuationToken = null;
    let totalDownloaded = 0;

    do {
      // List objects in bucket
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000, // Maximum allowed
      });

      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log('No objects found in bucket');
        break;
      }

      console.log(`Found ${listResponse.Contents.length} objects in this batch`);

      // Download each object
      for (const object of listResponse.Contents) {
        if (!object.Key) continue;

        try {
          // Create local file path preserving S3 key structure
          const localFilePath = path.join(localDir, object.Key);

          // Create directories if they don't exist
          const localDirPath = path.dirname(localFilePath);
          if (!fs.existsSync(localDirPath)) {
            fs.mkdirSync(localDirPath, { recursive: true });
          }

          // Download object
          const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: object.Key,
          });

          const getResponse = await s3Client.send(getCommand);

          if (getResponse.Body) {
            // Convert stream to buffer
            const reader = getResponse.Body.transformToByteArray();
            const buffer = await reader;

            // Write to file
            fs.writeFileSync(localFilePath, buffer);
            console.log(`Downloaded: ${object.Key} (${buffer.length} bytes)`);
            totalDownloaded++;
          }
        } catch (error) {
          console.error(`Failed to download ${object.Key}:`, error.message);
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    console.log(`✅ Download complete! Total files downloaded: ${totalDownloaded}`);
    console.log(`Files saved to: ${localDir}`);

  } catch (error) {
    console.error('❌ Download failed:', error.message);
    process.exit(1);
  }
}

// Run the download
downloadFromS3();
