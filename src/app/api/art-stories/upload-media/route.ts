import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getAWSBucketName, getS3Url } from '@/lib/s3-config';

export async function POST(request: NextRequest) {
  try {
    console.log('Art stories media upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const storyId = formData.get('storyId') as string;
    const itemId = formData.get('itemId') as string;
    const type = formData.get('type') as string; // 'story-image' for story icons

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    // For story items, itemId is required. For story images, it's not needed
    if (!type || type !== 'story-image') {
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required for item uploads' }, { status: 400 });
      }
    }

    console.log('Art stories media received:', file.name, 'for story:', storyId, type === 'story-image' ? '(story icon)' : `item: ${itemId}`);

    // Validate file type (support both images and videos)
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/avi'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    
    // Story images should only be images
    if (type === 'story-image' && !allowedImageTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type for story image. Only images (JPEG, PNG, GIF, WebP) are allowed.' 
      }, { status: 400 });
    } else if (type !== 'story-image' && !allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, OGG, MOV, AVI) are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (max 5MB for story images, 50MB for videos, 10MB for item images)
    let maxSize;
    if (type === 'story-image') {
      maxSize = 5 * 1024 * 1024; // 5MB for story icons
    } else if (file.type.startsWith('video/')) {
      maxSize = 50 * 1024 * 1024; // 50MB for videos
    } else {
      maxSize = 10 * 1024 * 1024; // 10MB for item images
    }
    
    if (file.size > maxSize) {
      const maxSizeMB = type === 'story-image' ? '5MB' : (file.type.startsWith('video/') ? '50MB' : '10MB');
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${maxSizeMB}.` 
      }, { status: 400 });
    }

    // Generate S3 key for art stories media
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    let s3Key;
    if (type === 'story-image') {
      // For story icons
      s3Key = `art-stories/${storyId}/story-icon/${timestamp}-${sanitizedFileName}`;
    } else {
      // For story item media
      const mediaType = file.type.startsWith('video/') ? 'videos' : 'images';
      s3Key = `art-stories/${storyId}/${mediaType}/${itemId}/${timestamp}-${sanitizedFileName}`;
    }
    
    console.log('Generated S3 key:', s3Key);

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
    const mediaUrl = getS3Url(s3Key);
    
    console.log('Art stories media upload successful. Media URL:', mediaUrl);

    // Return success response with media details
    return NextResponse.json({
      success: true,
      data: {
        url: mediaUrl,
        key: s3Key,
        filename: file.name,
        size: file.size,
        type: file.type,
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      },
    });
  } catch (error) {
    console.error('Art stories S3 upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media to S3', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}