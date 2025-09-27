#!/usr/bin/env node

/**
 * Database setup script
 * Run this script to initialize the database with the required tables and data
 * 
 * Usage: node scripts/setup-db.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    
    // Test connection
    const testResult = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connected at:', testResult.rows[0].current_time);
    
    // Create enums
    console.log('📝 Creating enums...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scene_type_enum') THEN
          CREATE TYPE scene_type_enum AS ENUM ('home','street');
          RAISE NOTICE 'Created scene_type_enum';
        ELSE
          RAISE NOTICE 'scene_type_enum already exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_type_enum') THEN
          CREATE TYPE theme_type_enum AS ENUM ('city','occasion');
          RAISE NOTICE 'Created theme_type_enum';
        ELSE
          RAISE NOTICE 'theme_type_enum already exists';
        END IF;
      END
      $$;
    `);

    // Create tables
    console.log('🗂️  Creating tables...');
    
    // Themes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id          BIGSERIAL PRIMARY KEY,
        theme_type  theme_type_enum,
        name        TEXT NOT NULL,
        image       TEXT,
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(theme_type)
    `);
    console.log('✅ Themes table created');

    // Scenes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id          BIGSERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        type        scene_type_enum,
        image       TEXT,
        theme_id    BIGINT REFERENCES themes(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scenes_theme_id ON scenes(theme_id)
    `);
    console.log('✅ Scenes table created');

    // Check if we have any themes, if not, create sample data
    const themeCount = await client.query('SELECT COUNT(*) FROM themes');
    if (parseInt(themeCount.rows[0].count) === 0) {
      console.log('🌱 Creating sample themes...');
      
      await client.query(`
        INSERT INTO themes (theme_type, name, metadata) VALUES 
        ('city', 'Mumbai Living', '{"description": "Urban lifestyle in Mumbai"}'),
        ('city', 'Delhi Modern', '{"description": "Contemporary Delhi homes"}'),
        ('occasion', 'Diwali Special', '{"description": "Festival themed decoration"}'),
        ('occasion', 'Wedding Celebration', '{"description": "Wedding themed setups"}')
      `);
      
      console.log('✅ Sample themes created');
    }

    // Show current themes
    const themes = await client.query('SELECT * FROM themes ORDER BY created_at');
    console.log('🎨 Current themes:');
    themes.rows.forEach(theme => {
      console.log(`  - ${theme.name} (${theme.theme_type || 'no type'}) - ID: ${theme.id}`);
    });

    console.log('\n🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };