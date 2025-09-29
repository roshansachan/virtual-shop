import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';
import { s3KeyToUrl, isS3Url } from '@/lib/s3-utils';
import type { DBSpace } from '@/types/database';

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

    // Get scene_id from query params if provided
    const { searchParams } = new URL(request.url);
    const sceneId = searchParams.get('scene_id');

    let queryText = `
      SELECT 
        id,
        scene_id,
        name,
        image,
        created_at,
        updated_at
      FROM spaces
    `;
    const queryParams: any[] = [];

    if (sceneId) {
      queryText += ' WHERE scene_id = $1';
      queryParams.push(parseInt(sceneId));
    }

    queryText += ' ORDER BY created_at DESC';

    // Query spaces
    const result = await query(queryText, queryParams);

    const spaces: DBSpace[] = result.rows.map(row => ({
      id: row.id,
      scene_id: row.scene_id,
      name: row.name,
      image: row.image && !isS3Url(row.image) ? s3KeyToUrl(row.image) : row.image, // Only convert if it's a key, not already a URL
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: spaces,
      count: spaces.length
    });

  } catch (error) {
    console.error('Error fetching spaces:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch spaces' },
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
    const { scene_id, name, image } = body;

    // Validate required fields
    if (!scene_id || typeof scene_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'scene_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate image if provided (should be S3 key or URL)
    if (image && typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'image must be a valid string' },
        { status: 400 }
      );
    }

    // Insert new space
    const result = await query(`
      INSERT INTO spaces (scene_id, name, image)
      VALUES ($1, $2, $3)
      RETURNING id, scene_id, name, image, created_at, updated_at
    `, [
      scene_id,
      name.trim(),
      image || null
    ]);

    const newSpace: DBSpace = {
      id: result.rows[0].id,
      scene_id: result.rows[0].scene_id,
      name: result.rows[0].name,
      image: result.rows[0].image && !isS3Url(result.rows[0].image) ? s3KeyToUrl(result.rows[0].image) : result.rows[0].image, // Only convert if it's a key, not already a URL
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: newSpace,
      message: 'Space created successfully'
    });

  } catch (error) {
    console.error('Error creating space:', error);
    
    // Handle foreign key constraint violations
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid scene_id: scene does not exist' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create space' },
      { status: 500 }
    );
  }
}

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
    const { id, name, image } = body;

    // Validate required fields
    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate image if provided (should be S3 key or URL)
    if (image !== null && image !== undefined && typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'image must be a valid string or null' },
        { status: 400 }
      );
    }

    // Update space
    const result = await query(`
      UPDATE spaces 
      SET name = $1, image = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, scene_id, name, image, created_at, updated_at
    `, [
      name.trim(),
      image || null,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Space not found' },
        { status: 404 }
      );
    }

    const updatedSpace: DBSpace = {
      id: result.rows[0].id,
      scene_id: result.rows[0].scene_id,
      name: result.rows[0].name,
      image: result.rows[0].image && !isS3Url(result.rows[0].image) ? s3KeyToUrl(result.rows[0].image) : result.rows[0].image, // Only convert if it's a key, not already a URL
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: updatedSpace,
      message: 'Space updated successfully'
    });

  } catch (error) {
    console.error('Error updating space:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update space' },
      { status: 500 }
    );
  }
}