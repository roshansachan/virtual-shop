#!/usr/bin/env node

/**
 * Script to upload all files from aws-bucket directory to S3 bucket
 * Preserves directory structure as S3 keys
 * Run with: node scripts/upload-s3-bucket.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
require('dotenv').config({ path: '.env.local' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.AWS_BUCKET_NAME || 'roposo-us-commerce';
const sourceDir = path.join(process.cwd(), process.env.AWS_BUCKET_NAME || 'roposo-us-commerce');

async function uploadFileToS3(filePath, s3Key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Client.send(uploadCommand);
    console.log(`✅ Uploaded: ${s3Key} (${fileContent.length} bytes)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${s3Key}:`, error.message);
    return false;
  }
}

async function uploadDirectory(dirPath, baseDir = '') {
  let totalUploaded = 0;
  let totalFailed = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        console.log(`📁 Processing directory: ${relativePath}`);
        const { uploaded, failed } = await uploadDirectory(itemPath, relativePath);
        totalUploaded += uploaded;
        totalFailed += failed;
      } else if (stat.isFile()) {
        const success = await uploadFileToS3(itemPath, relativePath);
        if (success) {
          totalUploaded++;
        } else {
          totalFailed++;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error.message);
    totalFailed++;
  }

  return { uploaded: totalUploaded, failed: totalFailed };
}

async function uploadO1VirtualShop() {
  try {
    console.log(`🚀 Starting upload to bucket: ${bucketName}`);
    console.log(`📂 Source directory: ${sourceDir}`);

    if (!fs.existsSync(sourceDir)) {
      console.error(`❌ Source directory does not exist: ${sourceDir}`);
      process.exit(1);
    }

    const { uploaded, failed } = await uploadDirectory(sourceDir);

    console.log(`\n📊 Upload Summary:`);
    console.log(`✅ Successfully uploaded: ${uploaded} files`);
    if (failed > 0) {
      console.log(`❌ Failed to upload: ${failed} files`);
    }
    console.log(`🎯 Total processed: ${uploaded + failed} files`);

    if (failed === 0) {
      console.log(`🎉 All files uploaded successfully!`);
    } else {
      console.log(`⚠️  Some files failed to upload. Check the logs above.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run the upload
uploadO1VirtualShop();
