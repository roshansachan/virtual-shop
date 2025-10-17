import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload JPEG, PNG, GIF, WebP, or SVG images.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB for themes)
    const maxSizeInMB = 5;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `File size must be less than ${maxSizeInMB}MB` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Ensure SVG files get the correct extension
    const finalExtension = file.type === 'image/svg+xml' && fileExtension !== 'svg' ? 'svg' : fileExtension;
    const fileName = `theme-${timestamp}-${randomString}.${finalExtension}`;
    
    // S3 key for themes folder
    const s3Key = `themes/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // Make the file publicly accessible
    });

    await s3Client.send(uploadCommand);

    // Return the S3 key instead of the full URL
    return NextResponse.json({
      success: true,
      data: {
        key: s3Key,           // Only return the key
        originalName: file.name,
        size: file.size,
        type: file.type,
      },
      message: 'Theme image uploaded successfully'
    });

  } catch (error) {
    console.error('Theme image upload failed:', error);
    
    if (error instanceof Error) {
      // Handle specific S3 errors
      if (error.message.includes('NoSuchBucket')) {
        return NextResponse.json(
          { success: false, error: 'S3 bucket not found. Please check configuration.' },
          { status: 500 }
        );
      }
      if (error.message.includes('AccessDenied')) {
        return NextResponse.json(
          { success: false, error: 'S3 access denied. Please check AWS credentials.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to upload theme image. Please try again.' },
      { status: 500 }
    );
  }
}