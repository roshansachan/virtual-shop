// Database entities based on db.sql
// Focus: Theme-related entities only

import { ThemeTypeValue, SceneTypeValue } from './enums';

// Themes table - updated structure based on latest db.sql
export interface DBTheme {
  id: number;
  theme_type: ThemeTypeValue | null;  // enum column, nullable
  name: string;
  image: string | null;
  metadata: Record<string, any>;  // JSONB field
  created_at: string;
  updated_at: string;
}

// Scenes table - theme-related fields only
export interface DBScene {
  id: number;
  name: string;
  type: SceneTypeValue | null;  // scene_type_enum, nullable
  image: string | null;
  theme_id: number | null;  // references themes(id)
  created_at: string;
  updated_at: string;
  theme?: DBTheme;  // Optional joined theme data
}

// Spaces table
export interface DBSpace {
  id: number;
  scene_id: number;  // references scenes(id)
  name: string;
  image: string | null;
  created_at: string;
  updated_at: string;
  scene?: DBScene;  // Optional joined scene data
}