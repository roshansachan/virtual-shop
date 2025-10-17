-- Migration: Update products table for Product Management
-- Add new columns needed for product management and S3 integration

-- Add new columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 100;

-- If we have existing data with 'image' column, copy it to 'image_url'
UPDATE products 
SET image_url = image 
WHERE image_url IS NULL AND image IS NOT NULL;

-- The old columns (original_price, discount_percentage) can remain for backward compatibility
-- The 'image' column can also remain for backward compatibility

-- Add index on s3_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_s3_key ON products(s3_key);