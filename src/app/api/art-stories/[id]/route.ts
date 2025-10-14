import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: Context) {
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

    // Validate ID
    const artStoryId = parseInt(id);
    if (isNaN(artStoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid art story ID' },
        { status: 400 }
      );
    }

    // Query art story by ID
    const result = await query(`
      SELECT 
        id,
        title,
        image,
        stories
      FROM art_stories
      WHERE id = $1
    `, [artStoryId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Art story not found' },
        { status: 404 }
      );
    }

    const artStory = {
      id: result.rows[0].id,
      title: result.rows[0].title,
      image: result.rows[0].image,
      stories: result.rows[0].stories || []
    };

    return NextResponse.json({
      success: true,
      data: artStory
    });

  } catch (error) {
    console.error('Error fetching art story:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch art story' },
      { status: 500 }
    );
  }
}