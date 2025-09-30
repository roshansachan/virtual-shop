import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';
import { s3KeyToUrl, isS3Url } from '@/lib/s3-utils';
import { getS3Client, getAWSBucketName } from '@/lib/s3-config';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const spaceId = parseInt(resolvedParams.id);

    // Validate ID
    if (isNaN(spaceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid space ID' },
        { status: 400 }
      );
    }

    // Query space with placements and products
    const queryText = `
      SELECT
        sp.id AS space_id,
        sp.name AS space_name,
        sp.image AS space_image,
        sp.created_at AS space_created_at,
        sp.updated_at AS space_updated_at,
        s.image AS scene_background_image,
        s.created_at AS scene_created_at,
        s.updated_at AS scene_updated_at,
        p.id AS placement_id,
        p.name AS placement_name,
        p.art_story_id AS placement_art_story_id,
        p.created_at AS placement_created_at,
        p.updated_at AS placement_updated_at,
        pi.id AS placement_image_id,
        pi.name AS placement_image_name,
        pi.image AS placement_image,
        pi.is_visible,
        pi.anchor_position,
        pi.position,
        pi.created_at AS placement_image_created_at,
        pi.updated_at AS placement_image_updated_at,
        pr.id AS product_id,
        pr.name AS product_name,
        pr.original_price,
        pr.discount_percentage,
        pr.image AS product_image,
        pr.created_at AS product_created_at,
        pr.updated_at AS product_updated_at
      FROM
        spaces sp
      LEFT JOIN
        scenes s ON sp.scene_id = s.id
      LEFT JOIN
        placements p ON sp.id = p.space_id
      LEFT JOIN
        placement_images pi ON p.id = pi.placement_id
      LEFT JOIN
        products pr ON pi.product_id = pr.id
      WHERE
        sp.id = $1
      ORDER BY
        p.id,
        pi.id
    `;

    let result;
    try {
      result = await query(queryText, [spaceId]);
    } catch (error) {
      // If the query fails (possibly due to missing art_story_id column), try without it
      if (error instanceof Error && error.message.includes('art_story_id')) {
        console.log('art_story_id column not found, falling back to query without it');
        const fallbackQueryText = queryText.replace(
          'p.art_story_id AS placement_art_story_id,',
          'NULL AS placement_art_story_id,'
        );
        result = await query(fallbackQueryText, [spaceId]);
      } else {
        throw error;
      }
    }
    
    console.log('Space query result:', result.rows);
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Space not found' },
        { status: 404 }
      );
    }

    // Transform the flat result into nested structure
    const spaceData = result.rows[0];
    const spaceConfig = {
      id: spaceData.space_id.toString(),
      name: spaceData.space_name,
      backgroundImage: spaceData.space_image && !isS3Url(spaceData.space_image)
        ? s3KeyToUrl(spaceData.space_image)
        : spaceData.space_image,
      // Note: backgroundImageSize will be determined client-side when image loads
      placements: [] as any[]
    };

    // Group by placements
    const placementsMap = new Map();

    result.rows.forEach(row => {
      const placementId = row.placement_id;

      if (!placementId) return; // Skip if no placement

      if (!placementsMap.has(placementId)) {
        placementsMap.set(placementId, {
          id: placementId.toString(),
          name: row.placement_name,
          art_story_id: row.placement_art_story_id,
          expanded: true, // Default to expanded
          visible: true,  // Default to visible
          products: []
        });
      }

      const placement = placementsMap.get(placementId);

      // Add product if placement image exists
      if (row.placement_image_id) {
        const position = row.position || {};

        placement.products.push({
          id: row.placement_image_id.toString(),
          name: row.placement_image_name || row.product_name || 'Unnamed Product',
          src: row.placement_image && !isS3Url(row.placement_image)
            ? s3KeyToUrl(row.placement_image)
            : row.placement_image,
          productImage: row.product_image,
          s3Key: row.placement_image,
          visible: row.is_visible || false,
          width: position.width || 100,
          height: position.height || 100,
          x: position.x || 0,
          y: position.y || 0,
          productInfo: row.product_id ? {
            productId: row.product_id,
            productName: row.product_name,
            originalPrice: row.original_price,
            discountPercentage: row.discount_percentage,
            productImage: row.product_image && !isS3Url(row.product_image)
              ? s3KeyToUrl(row.product_image)
              : row.product_image
          } : null
        });
      }
    });

    // Convert placements map to array
    spaceConfig.placements = Array.from(placementsMap.values());

    return NextResponse.json({
      success: true,
      data: spaceConfig
    });

  } catch (error) {
    console.error('Error fetching space configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch space configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const spaceId = parseInt(resolvedParams.id);

    // Validate ID
    if (isNaN(spaceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid space ID' },
        { status: 400 }
      );
    }

    // Get all S3 keys that need to be deleted
    const s3KeysQuery = `
      SELECT DISTINCT 
        s.image AS space_image,
        pi.image AS placement_image
      FROM spaces sp
      LEFT JOIN scenes s ON sp.scene_id = s.id
      LEFT JOIN placements p ON sp.id = p.space_id
      LEFT JOIN placement_images pi ON p.id = pi.placement_id
      WHERE sp.id = $1
        AND (s.image IS NOT NULL OR pi.image IS NOT NULL)
    `;
    
    const s3KeysResult = await query(s3KeysQuery, [spaceId]);
    const s3KeysToDelete: string[] = [];
    
    s3KeysResult.rows.forEach(row => {
      if (row.space_image && !isS3Url(row.space_image)) {
        s3KeysToDelete.push(row.space_image);
      }
      if (row.placement_image && !isS3Url(row.placement_image)) {
        s3KeysToDelete.push(row.placement_image);
      }
    });

    // Delete from database (this will cascade to related tables)
    const deleteResult = await query('DELETE FROM spaces WHERE id = $1 RETURNING id', [spaceId]);
    
    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Space not found' },
        { status: 404 }
      );
    }

    // Delete S3 objects if any exist
    if (s3KeysToDelete.length > 0) {
      const s3Client = getS3Client();
      const bucketName = getAWSBucketName();

      const deletePromises = s3KeysToDelete.map(async (key) => {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
          });
          await s3Client.send(deleteCommand);
          console.log(`Deleted S3 object: ${key}`);
        } catch (error) {
          console.error(`Failed to delete S3 object ${key}:`, error);
          // Continue with other deletions even if one fails
        }
      });

      await Promise.allSettled(deletePromises);
    }

    console.log(`Space ${spaceId} deleted successfully`);
    return NextResponse.json({
      success: true,
      message: 'Space deleted successfully',
      deletedId: spaceId
    });

  } catch (error) {
    console.error('Error deleting space:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete space' },
      { status: 500 }
    );
  }
}
