import { NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET() {
  try {
    console.log('Testing products table migration...');

    // Check if products table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      );
    `);

    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      // Create the full products table with all needed columns
      await query(`
        CREATE TABLE products (
          id BIGSERIAL PRIMARY KEY,
          name TEXT,
          original_price NUMERIC(12,2),
          discount_percentage NUMERIC(5,2),
          image TEXT,
          image_url TEXT,
          s3_key TEXT,
          width INTEGER DEFAULT 100,
          height INTEGER DEFAULT 100,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Add index
      await query(`
        CREATE INDEX IF NOT EXISTS idx_products_s3_key ON products(s3_key);
      `);
      
      return NextResponse.json({
        success: true,
        message: 'Products table created successfully',
        action: 'created'
      });
    }

    // Check which columns exist
    const columnsResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    const neededColumns = ['image_url', 's3_key', 'width', 'height'];
    const missingColumns = neededColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      // Add missing columns
      for (const column of missingColumns) {
        if (column === 'image_url' || column === 's3_key') {
          await query(`ALTER TABLE products ADD COLUMN ${column} TEXT;`);
        } else if (column === 'width' || column === 'height') {
          await query(`ALTER TABLE products ADD COLUMN ${column} INTEGER DEFAULT 100;`);
        }
      }

      // Copy existing image data to image_url if needed
      if (existingColumns.includes('image') && missingColumns.includes('image_url')) {
        await query(`
          UPDATE products 
          SET image_url = image 
          WHERE image_url IS NULL AND image IS NOT NULL;
        `);
      }

      // Add index
      await query(`
        CREATE INDEX IF NOT EXISTS idx_products_s3_key ON products(s3_key);
      `);

      return NextResponse.json({
        success: true,
        message: `Products table updated successfully. Added columns: ${missingColumns.join(', ')}`,
        action: 'updated',
        addedColumns: missingColumns
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Products table already has all required columns',
      action: 'none',
      existingColumns
    });

  } catch (error) {
    console.error('Products table migration failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Products table migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}