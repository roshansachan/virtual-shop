import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const sceneId = parseInt(resolvedParams.id);

    // Validate ID
    if (isNaN(sceneId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid scene ID' },
        { status: 400 }
      );
    }

    // Execute the comprehensive scene query
    const queryText = `
      SELECT 
          s.name AS scene_name, 
          s.type AS scene_type, 
          s.image AS scene_image, 
          s.created_at AS scene_created_at,
          s.updated_at AS scene_updated_at,
          t.theme_type, 
          t.name AS theme_name,
          t.slug AS theme_slug,
          t.image AS theme_image,
          t.metadata AS theme_metadata,
          t.created_at AS theme_created_at,
          t.updated_at AS theme_updated_at,
          sp.id AS space_id, 
          sp.name AS space_name, 
          sp.image AS space_image,
          sp.created_at AS space_created_at,
          sp.updated_at AS space_updated_at,
          p.id AS placement_id, 
          p.name AS placement_name,
          p.created_at AS placement_created_at,
          p.updated_at AS placement_updated_at,
          pi.id AS placement_image_id, 
          pi.name AS placement_image_name, 
          pi.is_visible, 
          pi.anchor_position, 
          pi.position,
          pi.image AS placement_image,
          pi.created_at AS placement_image_created_at,
          pi.updated_at AS placement_image_updated_at,
          pr.id AS product_id, 
          pr.name AS product_name, 
          pr.original_price, 
          pr.discount_percentage, 
          pr.image AS product_image,
          pr.created_at AS product_created_at,
          pr.updated_at AS product_updated_at
      FROM 
          scenes s
      LEFT JOIN 
          themes t ON s.theme_id = t.id
      LEFT JOIN 
          spaces sp ON s.id = sp.scene_id
      LEFT JOIN 
          placements p ON sp.id = p.space_id
      LEFT JOIN 
          placement_images pi ON p.id = pi.placement_id
      LEFT JOIN 
          products pr ON pi.product_id = pr.id
      WHERE 
          s.id = $1
    `;

    const result = await query(queryText, [sceneId]);

    // Return the raw query result for now (we can transform it later if needed)
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      scene_id: sceneId
    });

  } catch (error) {
    console.error('Error fetching comprehensive scene data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scene data' },
      { status: 500 }
    );
  }
}