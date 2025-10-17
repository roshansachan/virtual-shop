// Database entities and application types

// Theme-related imports and exports (focusing on themes only as requested)
export type { DBTheme } from './database';
export { ThemeType, SceneType } from './enums';
export type { ThemeTypeValue, SceneTypeValue } from './enums';

// Re-export DBTheme as Theme for backward compatibility in components
import type { DBTheme } from './database';
export type Theme = DBTheme;

// Legacy frontend types (keeping for backward compatibility)
// TODO: These will be updated in future iterations

// Space
export interface DBSpace {
  id: number;
  scene_id: number;
  name: string;
  image: string | null;
  created_at: string;
  updated_at: string;
}

// Placement
export interface DBPlacement {
  id: number;
  space_id: number;
  name: string;
  art_story_id?: number | null; // Add art_story_id field
  created_at: string;
  updated_at: string;
}

// Product
export interface DBProduct {
  id: number;
  name: string;
  original_price: number | null;
  discount_percentage: number | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

// Placement Images
export interface DBPlacementImage {
  id: number;
  placement_id: number;
  name: string;
  image: string;
  is_visible: boolean;
  anchor_position: { x: number; y: number };
  position: { x: number; y: number };
  product_id: number | null;
  created_at: string;
  updated_at: string;
  product?: DBProduct; // Optional joined data
}

// Legacy types for current frontend (keeping these for backward compatibility)
export interface Scene {
  id: string;
  name: string;
  type?: string; // scene type
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  spaces: Space[];
  backgroundImageS3Key?: string;
  theme_id?: number; // theme reference
  dbId?: string; // Database ID
}

export interface Space {
  id: string;
  name: string;
  placements: Placement[];
  expanded?: boolean; // UI state
  visible?: boolean; // UI state
  image?: string; // Image URL
  imageS3Key?: string; // S3 key for the image
  dbId?: string; // Database ID
}

export interface Placement {
  id: string;
  name: string;
  art_story_id?: number | null; // Add art_story_id field
  products: Product[];
  activeProductId?: string;
  dbId?: string; // Database ID
  placementImages?: { 
    id: number; 
    name: string; 
    image: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    visible?: boolean;
  }[]; // Product images from DB
  activeProductImageId?: number; // Active placement image ID
}

export interface Product {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  visible: boolean;
  s3Key: string;
  x: number;
  y: number;
  productInfo?: {
    productId: string;
    productName: string;
    originalPrice: string;
    discountPercentage: string;
    productImage: string;
  } | null
}

export interface PlacedProduct {
  id: string;
  productId: string;
  placementName: string;
  spaceName: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  sceneId: string;
  visible: boolean;
}

// Space configuration as returned by the spaces/[id] API
export interface SpaceConfig {
  id: string;
  name: string;
  image?: string;
  themeId?: number;
  themeIcon?: string;
  type: string;
  backgroundImage?: string;
  backgroundImageSize?: { width: number; height: number };
  backgroundImageS3Key?: string;
  placements: Array<{
    id: string;
    name: string;
    art_story_id?: number | null; // Add art_story_id field
    expanded: boolean;
    visible: boolean;
    products: Array<{
      id: string;
      name: string;
      src: string;
      s3Key: string;
      visible: boolean;
      width: number;
      height: number;
      x: number;
      y: number;
    }>;
  }>;
}