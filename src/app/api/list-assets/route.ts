import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client, getAWSBucketName, getS3Url } from '@/lib/s3-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const maxKeys = parseInt(searchParams.get('maxKeys') || '100');

    // Get S3 client and bucket name
    const s3Client = getS3Client();
    const bucketName = getAWSBucketName();

    // List objects from S3
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await s3Client.send(listCommand);
    
    // Format the response with additional metadata
    const assets = response.Contents?.map(obj => ({
      key: obj.Key!,
      size: obj.Size!,
      lastModified: obj.LastModified!,
      url: getS3Url(obj.Key!),
      filename: obj.Key!.split('/').pop() || obj.Key!,
      type: getFileType(obj.Key!),
      placement: getPlacementPath(obj.Key!),
    })) || [];

    // Group assets by scene and placement for better organization
    // const groupedAssets = groupAssetsByPath(assets);

    return NextResponse.json({
      success: true,
      data: {
        assets,
        // groupedAssets,
        totalCount: response.KeyCount || 0,
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
      },
    });
  } catch (error) {
    console.error('S3 list error:', error);
    return NextResponse.json(
      { error: 'Failed to list S3 assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getFileType(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'unknown';
  }
}

function getPlacementPath(key: string): string {
  const parts = key.split('/');
  parts.pop(); // Remove filename
  return parts.join('/');
}

// function groupAssetsByPath(assets: any[]) {
//   const grouped: { [key: string]: any[] } = {};
//
//   assets.forEach(asset => {
//     const pathParts = asset.key.split('/');
//     let groupKey = 'root';
//
//     if (pathParts.length >= 3 && pathParts[0] === 'scenes') {
//       // Format: scenes/sceneId/products/placementId/ or scenes/sceneId/backgrounds/
//       const sceneId = pathParts[1];
//       const type = pathParts[2]; // 'products' or 'backgrounds'
//
//       if (type === 'backgrounds') {
//         groupKey = `scenes/${sceneId}/backgrounds`;
//       } else if (type === 'products' && pathParts.length >= 4) {
//         const placementId = pathParts[3];
//         groupKey = `scenes/${sceneId}/products/${placementId}`;
//       }
//     } else {
//       groupKey = asset.placement;
//     }
//
//     if (!grouped[groupKey]) {
//       grouped[groupKey] = [];
//     }
//     grouped[groupKey].push(asset);
//   });
//
//   return grouped;
// }
