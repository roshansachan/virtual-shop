import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectsCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getAWSBucketName, getS3Url } from '@/lib/s3-config';

export async function POST(request: NextRequest) {
  try {
    const { action, keys, targetPrefix } = await request.json();

    if (!action || !keys || !Array.isArray(keys)) {
      return NextResponse.json({ error: 'Missing action or keys' }, { status: 400 });
    }

    const s3Client = getS3Client();
    const bucketName = getAWSBucketName();

    let result;

    switch (action) {
      case 'delete':
        result = await deleteMultipleAssets(s3Client, bucketName, keys);
        break;
      case 'copy':
        if (!targetPrefix) {
          return NextResponse.json({ error: 'Target prefix required for copy operation' }, { status: 400 });
        }
        result = await copyMultipleAssets(s3Client, bucketName, keys, targetPrefix);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Batch operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform batch operation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function deleteMultipleAssets(s3Client: any, bucketName: string, keys: string[]) {
  // AWS S3 allows deletion of up to 1000 objects at once
  const batchSize = 1000;
  const results = [];
  
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
        Quiet: true,
      },
    });

    const response = await s3Client.send(deleteCommand);
    results.push({
      deleted: batch.length - (response.Errors?.length || 0),
      errors: response.Errors || [],
    });
  }

  return {
    totalProcessed: keys.length,
    totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
    errors: results.flatMap(r => r.errors),
  };
}

async function copyMultipleAssets(s3Client: any, bucketName: string, keys: string[], targetPrefix: string) {
  const results = [];
  const errors = [];

  for (const key of keys) {
    try {
      // Generate new key with target prefix
      const filename = key.split('/').pop();
      const newKey = `${targetPrefix}/${Date.now()}-${filename}`;

      const copyCommand = new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${key}`,
        Key: newKey,
        ACL: 'public-read',
      });

      await s3Client.send(copyCommand);
      
      results.push({
        originalKey: key,
        newKey: newKey,
        url: getS3Url(newKey),
      });
    } catch (error) {
      errors.push({
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    totalProcessed: keys.length,
    totalCopied: results.length,
    copied: results,
    errors,
  };
}
