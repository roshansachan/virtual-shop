import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

export async function PUT(request: NextRequest) {
  try {
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
    const { placement_id, active_placement_image_id } = body;

    // Validate required fields
    if (!placement_id || typeof placement_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'placement_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!active_placement_image_id || typeof active_placement_image_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'active_placement_image_id is required and must be a number' },
        { status: 400 }
      );
    }

    // Begin transaction
    await query('BEGIN');

    try {
      // First, set all images in this placement to not visible
      await query(
        'UPDATE placement_images SET is_visible = false WHERE placement_id = $1',
        [placement_id]
      );

      // Then, set the specific image to visible
      const result = await query(
        `UPDATE placement_images 
         SET is_visible = true, updated_at = NOW() 
         WHERE id = $1 AND placement_id = $2
         RETURNING id, placement_id, name, image, is_visible, anchor_position, position, product_id, created_at, updated_at`,
        [active_placement_image_id, placement_id]
      );

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Placement image not found or does not belong to the specified placement' },
          { status: 404 }
        );
      }

      // Commit transaction
      await query('COMMIT');

      const updatedPlacementImage = {
        id: result.rows[0].id,
        placement_id: result.rows[0].placement_id,
        name: result.rows[0].name,
        image: result.rows[0].image,
        is_visible: result.rows[0].is_visible,
        anchor_position: result.rows[0].anchor_position || {},
        position: result.rows[0].position || {},
        product_id: result.rows[0].product_id,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at
      };

      return NextResponse.json({
        success: true,
        data: updatedPlacementImage,
        message: 'Active placement image updated successfully'
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error setting active placement image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set active placement image' },
      { status: 500 }
    );
  }
}