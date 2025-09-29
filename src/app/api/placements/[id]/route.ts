import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

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

    // Delete placement
    const result = await query(`
      DELETE FROM placements WHERE id = $1
      RETURNING id, name
    `, [parseInt(id)]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Placement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Placement "${result.rows[0].name}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting placement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete placement' },
      { status: 500 }
    );
  }
}