import { Pool, PoolClient } from 'pg';

// Create a connection pool using environment variables
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Export the pool for direct use
export { pool };

// Utility function to get a client from the pool
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

// Utility function to execute a query with automatic client management
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Function to test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Function to initialize database with our schema
export async function initializeDatabase(): Promise<void> {
  try {
    // Create enums if they don't exist
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scene_type_enum') THEN
          CREATE TYPE scene_type_enum AS ENUM ('home','street');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_type_enum') THEN
          CREATE TYPE theme_type_enum AS ENUM ('city','occasion');
        END IF;
      END
      $$;
    `);

    // Create themes table
    await query(`
      CREATE TABLE IF NOT EXISTS themes (
        id          BIGSERIAL PRIMARY KEY,
        theme_type  theme_type_enum,
        name        TEXT,
        image       TEXT,
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create index
    await query(`
      CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(theme_type)
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}