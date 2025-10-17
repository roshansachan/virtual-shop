import { query } from '../src/lib/database.ts';

async function migrateProductsTable() {
  try {
    console.log('Starting products table migration...');

    // Check if products table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      );
    `);

    const tableExists = tableCheckResult.rows[0].exists;
    console.log(`Products table exists: ${tableExists}`);

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
      console.log('Created products table with all columns');
    } else {
      // Add new columns if they don't exist
      console.log('Checking and adding missing columns...');
      
      // Check which columns exist
      const columnsResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products'
      `);
      
      const existingColumns = columnsResult.rows.map(row => row.column_name);
      console.log('Existing columns:', existingColumns);

      // Add missing columns
      if (!existingColumns.includes('image_url')) {
        await query(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
        console.log('Added image_url column');
      }

      if (!existingColumns.includes('s3_key')) {
        await query(`ALTER TABLE products ADD COLUMN s3_key TEXT;`);
        console.log('Added s3_key column');
      }

      if (!existingColumns.includes('width')) {
        await query(`ALTER TABLE products ADD COLUMN width INTEGER DEFAULT 100;`);
        console.log('Added width column');
      }

      if (!existingColumns.includes('height')) {
        await query(`ALTER TABLE products ADD COLUMN height INTEGER DEFAULT 100;`);
        console.log('Added height column');
      }

      // Copy existing image data to image_url if needed
      if (existingColumns.includes('image') && existingColumns.includes('image_url')) {
        await query(`
          UPDATE products 
          SET image_url = image 
          WHERE image_url IS NULL AND image IS NOT NULL;
        `);
        console.log('Copied existing image data to image_url');
      }
    }

    // Add index
    await query(`
      CREATE INDEX IF NOT EXISTS idx_products_s3_key ON products(s3_key);
    `);
    console.log('Added index on s3_key');

    console.log('Products table migration completed successfully');

    // Show final table structure
    const finalColumns = await query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);

    console.log('\nFinal products table structure:');
    finalColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}${col.column_default ? ` (default: ${col.column_default})` : ''} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateProductsTable();