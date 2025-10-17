import { NextResponse } from 'next/server';
import { testConnection, initializeDatabase } from '@/lib/database';

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

    // Initialize database tables
    await initializeDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful and tables initialized',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}