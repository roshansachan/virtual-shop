import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';
import type { DBPlacementImage } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get placement_id from query params if provided
    const { searchParams } = new URL(request.url);
    const placementId = searchParams.get('placement_id');

    let queryText = `
      SELECT 
        id,
        placement_id,
        name,
        image,
        is_visible,
        anchor_position,
        position,
        product_id,
        created_at,
        updated_at
      FROM placement_images
    `;
    let queryParams: any[] = [];

    if (placementId) {
      queryText += ' WHERE placement_id = $1';
      queryParams.push(parseInt(placementId));
    }

    queryText += ' ORDER BY created_at DESC';

    // Query placement images
    const result = await query(queryText, queryParams);

    const placementImages: DBPlacementImage[] = result.rows.map(row => ({
      id: row.id,
      placement_id: row.placement_id,
      name: row.name,
      image: row.image,
      is_visible: row.is_visible,
      anchor_position: row.anchor_position || {},
      position: row.position || {},
      product_id: row.product_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: placementImages,
      count: placementImages.length
    });

  } catch (error) {
    console.error('Error fetching placement images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch placement images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { placement_id, name, image, is_visible, anchor_position, position, product_id } = body;

    // Validate required fields
    if (!placement_id || typeof placement_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'placement_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Image is required and must be a string' },
        { status: 400 }
      );
    }

    // Insert new placement image
    const result = await query(`
      INSERT INTO placement_images (placement_id, name, image, is_visible, anchor_position, position, product_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, placement_id, name, image, is_visible, anchor_position, position, product_id, created_at, updated_at
    `, [
      placement_id,
      name.trim(),
      image,
      is_visible || false,
      JSON.stringify(anchor_position || {}),
      JSON.stringify(position || {}),
      product_id || null
    ]);

    const newPlacementImage: DBPlacementImage = {
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
      data: newPlacementImage,
      message: 'Placement image created successfully'
    });

  } catch (error) {
    console.error('Error creating placement image:', error);
    
    // Handle foreign key constraint violations
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid placement_id or product_id' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create placement image' },
      { status: 500 }
    );
  }
}