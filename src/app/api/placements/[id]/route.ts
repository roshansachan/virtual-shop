import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';
import { isS3Url } from '@/lib/s3-utils';
import { getS3Client, getAWSBucketName } from '@/lib/s3-config';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

interface Context {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, art_story_id } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Update placement
    const result = await query(`
      UPDATE placements 
      SET name = $1, art_story_id = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, space_id, name, art_story_id, created_at, updated_at
    `, [
      name.trim(),
      art_story_id || null,
      parseInt(id)
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Placement not found' },
        { status: 404 }
      );
    }

    const updatedPlacement = {
      id: result.rows[0].id,
      space_id: result.rows[0].space_id,
      name: result.rows[0].name,
      art_story_id: result.rows[0].art_story_id,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: updatedPlacement,
      message: 'Placement updated successfully'
    });

  } catch (error) {
    console.error('Error updating placement:', error);
    
    // Handle foreign key constraint violations
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid art_story_id' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update placement' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const placementId = parseInt(id);
    if (isNaN(placementId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid placement ID' },
        { status: 400 }
      );
    }

    // Get all S3 keys for placement images that need to be deleted
    const s3KeysQuery = `
      SELECT image FROM placement_images 
      WHERE placement_id = $1 AND image IS NOT NULL
    `;
    
    const s3KeysResult = await query(s3KeysQuery, [placementId]);
    const s3KeysToDelete: string[] = [];
    
    s3KeysResult.rows.forEach(row => {
      if (row.image && !isS3Url(row.image)) {
        s3KeysToDelete.push(row.image);
      }
    });

    // Delete placement
    const result = await query(`
      DELETE FROM placements WHERE id = $1
      RETURNING id, name
    `, [placementId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Placement not found' },
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

    return NextResponse.json({
      success: true,
      message: `Placement "${result.rows[0].name}" deleted successfully`,
      deletedId: placementId
    });

  } catch (error) {
    console.error('Error deleting placement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete placement' },
      { status: 500 }
    );
  }
}