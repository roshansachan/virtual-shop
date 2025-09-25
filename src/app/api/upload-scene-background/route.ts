import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getAWSBucketName, generateSceneBackgroundS3Key, getS3Url } from '@/lib/s3-config';

export async function POST(request: NextRequest) {
  try {
    console.log('Scene background upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sceneId = formData.get('sceneId') as string;

    console.log('Received file:', file?.name, 'Scene ID:', sceneId);

    if (!file) {
      console.error('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!sceneId) {
      console.error('Missing sceneId');
      return NextResponse.json({ error: 'Missing sceneId' }, { status: 400 });
    }

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

    // Generate S3 key for scene background
    const s3Key = generateSceneBackgroundS3Key(sceneId, file.name);
    console.log('Generated S3 key:', s3Key);

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log('File buffer size:', fileBuffer.length);

    // Get S3 client and bucket name
    const s3Client = getS3Client();
    const bucketName = getAWSBucketName();
    console.log('S3 bucket:', bucketName);

        // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type,
      ACL: 'public-read', // Make the object publicly readable
    });

    console.log('Uploading to S3 with command:', { Bucket: bucketName, Key: s3Key, ContentType: file.type, ACL: 'public-read' });
    const result = await s3Client.send(command);
    console.log('S3 upload result:', result);

    // Generate public URL
    const imageUrl = getS3Url(s3Key);

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
    console.error('S3 scene background upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload scene background image to S3' },
      { status: 500 }
    );
  }
}