import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    if (!(await testConnection())) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const productId = params.id;

    const result = await query(`
      SELECT 
        id,
        name,
        image,
        original_price,
        discount_percentage,
        created_at,
        updated_at
      FROM products 
      WHERE id = $1
    `, [productId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    if (!(await testConnection())) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const productId = params.id;
    const { name, image, original_price, discount_percentage } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const result = await query(`
      UPDATE products 
      SET 
        name = $1,
        image = $2,
        original_price = $3,
        discount_percentage = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING 
        id,
        name,
        image,
        original_price,
        discount_percentage,
        created_at,
        updated_at
    `, [name, image, original_price || null, discount_percentage || null, productId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    if (!(await testConnection())) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const params = await context.params;
    const productId = params.id;

    const result = await query(`
      DELETE FROM products 
      WHERE id = $1
      RETURNING 
        id,
        name,
        image,
        original_price,
        discount_percentage,
        created_at,
        updated_at
    `, [productId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}