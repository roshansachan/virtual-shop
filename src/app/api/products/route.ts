import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

// GET /api/products - List all products
export async function GET() {
  try {
    // Test database connection
    if (!(await testConnection())) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Ensure products table has all required columns
    await ensureProductsTableSchema();

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
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// Helper function to ensure products table has all required columns
async function ensureProductsTableSchema() {
  try {
    // Check if products table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      );
    `);

    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      // Create the products table with the standard schema
      await query(`
        CREATE TABLE products (
          id BIGSERIAL PRIMARY KEY,
          name TEXT,
          original_price NUMERIC(12,2),
          discount_percentage NUMERIC(5,2),
          image TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      console.log('Created products table');
    }

  } catch (error) {
    console.error('Error ensuring products table schema:', error);
    throw error;
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    // Test database connection
    if (!(await testConnection())) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const { name, image, original_price, discount_percentage } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const result = await query(`
      INSERT INTO products (name, image, original_price, discount_percentage)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        name,
        image,
        original_price,
        discount_percentage,
        created_at,
        updated_at
    `, [name, image, original_price || null, discount_percentage || null]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}