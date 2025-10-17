import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getAWSBucketName, getS3Url } from '@/lib/s3-config';

export async function POST(request: NextRequest) {
  try {
    console.log('Product upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Product image received:', file.name);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Generate S3 key for products folder
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `products/${timestamp}-${sanitizedFileName}`;
    
    console.log('Generated product S3 key:', s3Key);

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Get S3 client and bucket name
    const s3Client = getS3Client();
    const bucketName = getAWSBucketName();

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type,
      // Make file publicly accessible
      ACL: 'public-read',
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const imageUrl = getS3Url(s3Key);
    
    console.log('Product upload successful. Image URL:', imageUrl);

    // Return success response with image details
    return NextResponse.json({
      success: true,
      data: {
        url: imageUrl,
        key: s3Key,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Product S3 upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload product image to S3', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}