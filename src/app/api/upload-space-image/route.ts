import { NextRequest, NextResponse } from 'next/server';
import { S3Client,PutObjectCommand } from '@aws-sdk/client-s3';

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
    const spaceId = formData.get('spaceId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!spaceId) {
      return NextResponse.json(
        { success: false, error: 'No spaceId provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload JPEG, PNG, GIF, WebP, or SVG images.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSizeInMB = 10;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `File size must be less than ${maxSizeInMB}MB` },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Determine file extension based on MIME type or filename
    let extension = '';
    if (file.type === 'image/jpeg') extension = '.jpg';
    else if (file.type === 'image/png') extension = '.png';
    else if (file.type === 'image/gif') extension = '.gif';
    else if (file.type === 'image/webp') extension = '.webp';
    else if (file.type === 'image/svg+xml') extension = '.svg';
    else {
      // Fallback to file extension from filename
      const fileExtension = sanitizedFilename.split('.').pop()?.toLowerCase();
      if (fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension)) {
        extension = `.${fileExtension}`;
      } else {
        extension = '.jpg'; // Default fallback
      }
    }

    const s3Key = `spaces/${spaceId}/images/${timestamp}_${sanitizedFilename}${extension}`;

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
        filename: file.name,
        size: file.size,
        type: file.type
      }
    });

  } catch (error) {
    console.error('Space image upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}