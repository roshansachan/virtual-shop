import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';
import { s3KeyToUrl, isS3Url } from '@/lib/s3-utils';
import type { DBTheme } from '@/types/database';

export async function GET() {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Query all themes
    const result = await query(`
      SELECT 
        id,
        theme_type,
        name,
        image,
        metadata,
        created_at,
        updated_at
      FROM themes 
      ORDER BY created_at DESC
    `);

    const themes: DBTheme[] = result.rows.map(row => ({
      id: row.id,
      theme_type: row.theme_type,
      name: row.name,
      image: row.image && !isS3Url(row.image) ? s3KeyToUrl(row.image) : row.image, // Only convert if it's a key, not already a URL
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: themes,
      count: themes.length
    });

  } catch (error) {
    console.error('Error fetching themes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch themes' },
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
    const { name, theme_type, image, metadata } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate theme_type if provided
    if (theme_type && !['city', 'occasion'].includes(theme_type)) {
      return NextResponse.json(
        { success: false, error: 'theme_type must be either "city" or "occasion"' },
        { status: 400 }
      );
    }

    // Validate image URL if provided
    if (image && typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'image must be a valid URL string' },
        { status: 400 }
      );
    }

    // Insert new theme
    const result = await query(`
      INSERT INTO themes (theme_type, name, image, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id, theme_type, name, image, metadata, created_at, updated_at
    `, [
      theme_type || null,
      name.trim(),
      image || null,
      metadata || {}
    ]);

    const newTheme: DBTheme = {
      id: result.rows[0].id,
      theme_type: result.rows[0].theme_type,
      name: result.rows[0].name,
      image: result.rows[0].image && !isS3Url(result.rows[0].image) ? s3KeyToUrl(result.rows[0].image) : result.rows[0].image, // Only convert if it's a key, not already a URL
      metadata: result.rows[0].metadata,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: newTheme,
      message: 'Theme created successfully'
    });

  } catch (error) {
    console.error('Error creating theme:', error);
    
    // Handle unique constraint violations or other DB errors
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { success: false, error: 'Theme with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create theme' },
      { status: 500 }
    );
  }
}