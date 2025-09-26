import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

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
    const placementImageId = parseInt(resolvedParams.id);

    // Validate ID
    if (isNaN(placementImageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid placement image ID' },
        { status: 400 }
      );
    }

    // Check if placement image exists
    const checkResult = await query(
      'SELECT id FROM placement_images WHERE id = $1',
      [placementImageId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Placement image not found' },
        { status: 404 }
      );
    }

    // Delete the placement image
    const result = await query(
      'DELETE FROM placement_images WHERE id = $1 RETURNING id',
      [placementImageId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete placement image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Placement image deleted successfully',
      data: { id: placementImageId }
    });

  } catch (error) {
    console.error('Error deleting placement image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete placement image' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const placementImageId = parseInt(resolvedParams.id);

    // Validate ID
    if (isNaN(placementImageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid placement image ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, image, is_visible, position, anchor_position, product_id } = body;

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (image !== undefined) {
      updateFields.push(`image = $${paramIndex}`);
      updateValues.push(image);
      paramIndex++;
    }

    if (is_visible !== undefined) {
      updateFields.push(`is_visible = $${paramIndex}`);
      updateValues.push(is_visible);
      paramIndex++;
    }

    if (position !== undefined) {
      updateFields.push(`position = $${paramIndex}`);
      updateValues.push(JSON.stringify(position));
      paramIndex++;
    }

    if (anchor_position !== undefined) {
      updateFields.push(`anchor_position = $${paramIndex}`);
      updateValues.push(JSON.stringify(anchor_position));
      paramIndex++;
    }

    if (product_id !== undefined) {
      updateFields.push(`product_id = $${paramIndex}`);
      updateValues.push(product_id);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at field
    updateFields.push(`updated_at = NOW()`);
    
    // Add WHERE clause parameter
    updateValues.push(placementImageId);

    const updateQuery = `
      UPDATE placement_images 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, placement_id, name, image, is_visible, anchor_position, position, product_id, created_at, updated_at
    `;

    const result = await query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Placement image not found' },
        { status: 404 }
      );
    }

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
      message: 'Placement image updated successfully'
    });

  } catch (error) {
    console.error('Error updating placement image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update placement image' },
      { status: 500 }
    );
  }
}