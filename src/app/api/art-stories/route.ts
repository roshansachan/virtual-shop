import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET - Fetch all art stories
export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM art_stories ORDER BY id DESC');
    client.release();
    
    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching art stories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch art stories' },
      { status: 500 }
    );
  }
}

// POST - Create new art story
export async function POST(request: NextRequest) {
  try {
    const { title, image, stories = [] } = await request.json();
    
    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO art_stories (title, image, stories) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), image || null, JSON.stringify(stories)]
    );
    client.release();
    
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating art story:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create art story' },
      { status: 500 }
    );
  }
}

// PUT - Update existing art story
export async function PUT(request: NextRequest) {
  try {
    const { id, title, image, stories } = await request.json();
    
    if (!id || !title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'ID and title are required' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    const result = await client.query(
      'UPDATE art_stories SET title = $1, image = $2, stories = $3 WHERE id = $4 RETURNING *',
      [title.trim(), image || null, JSON.stringify(stories || []), id]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Art story not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating art story:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update art story' },
      { status: 500 }
    );
  }
}

// DELETE - Delete art story
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    const result = await client.query(
      'DELETE FROM art_stories WHERE id = $1 RETURNING *',
      [id]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Art story not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting art story:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete art story' },
      { status: 500 }
    );
  }
}
