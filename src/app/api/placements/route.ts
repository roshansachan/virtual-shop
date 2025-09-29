import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

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

    // Get space_id from query params if provided
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('space_id');

    let queryText = `
      SELECT 
        p.id,
        p.space_id,
        p.name,
        p.created_at,
        p.updated_at,
        a.id as art_story_id,
        a.title as art_story_title
      FROM placements p
      LEFT JOIN art_stories a ON p.art_story_id = a.id
    `;
    const queryParams: any[] = [];

    if (spaceId) {
      queryText += ' WHERE p.space_id = $1';
      queryParams.push(parseInt(spaceId));
    }

    queryText += ' ORDER BY p.created_at DESC';

    // Query placements
    const result = await query(queryText, queryParams);

    const placements = result.rows.map(row => ({
      id: row.id,
      space_id: row.space_id,
      name: row.name,
      art_story_id: row.art_story_id,
      art_story_title: row.art_story_title,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: placements,
      count: placements.length
    });

  } catch (error) {
    console.error('Error fetching placements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch placements' },
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
    const { space_id, name, art_story_id } = body;

    // Validate required fields
    if (!space_id || typeof space_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'space_id is required and must be a number' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Insert new placement
    const result = await query(`
      INSERT INTO placements (space_id, name, art_story_id)
      VALUES ($1, $2, $3)
      RETURNING id, space_id, name, art_story_id, created_at, updated_at
    `, [
      space_id,
      name.trim(),
      art_story_id || null
    ]);

    const newPlacement = {
      id: result.rows[0].id,
      space_id: result.rows[0].space_id,
      name: result.rows[0].name,
      art_story_id: result.rows[0].art_story_id,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: newPlacement,
      message: 'Placement created successfully'
    });

  } catch (error) {
    console.error('Error creating placement:', error);
    
    // Handle foreign key constraint violations
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
      return NextResponse.json(
        { success: false, error: 'Invalid space_id or art_story_id' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create placement' },
      { status: 500 }
    );
  }
}
