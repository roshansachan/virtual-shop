-- Fixed sets as ENUMs (simple + fast filters)
CREATE TYPE scene_type_enum AS ENUM ('home','street');
CREATE TYPE theme_type_enum AS ENUM ('city','occasion');

-- 1) THEMES (theme_type is now a column here)
CREATE TABLE IF NOT EXISTS themes (
  id          BIGSERIAL PRIMARY KEY,
  theme_type  theme_type_enum,          -- optional (leave NULL allowed)
  name        TEXT,
  slug        TEXT,
  image       TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(theme_type);

-- 2) SCENES (points to a THEME)
CREATE TABLE IF NOT EXISTS scenes (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT,
  type        scene_type_enum,          -- 'home' | 'street'
  image       TEXT,
  theme_id    BIGINT REFERENCES themes(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scenes_theme_id ON scenes(theme_id);

-- 3) SPACES (many → one SCENE)
CREATE TABLE IF NOT EXISTS spaces (
  id          BIGSERIAL PRIMARY KEY,
  scene_id    BIGINT REFERENCES scenes(id) ON DELETE CASCADE,
  name        TEXT,
  image       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spaces_scene_id ON spaces(scene_id);

-- 4) PLACEMENTS (many → one SPACE)
CREATE TABLE IF NOT EXISTS placements (
  id           BIGSERIAL PRIMARY KEY,
  space_id     BIGINT REFERENCES spaces(id) ON DELETE CASCADE,
  name         TEXT,
  art_story_id BIGINT REFERENCES art_stories(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_placements_space_id ON placements(space_id);
CREATE INDEX IF NOT EXISTS idx_placements_art_story_id ON placements(art_story_id);

-- 5) PRODUCTS (reusable)
CREATE TABLE IF NOT EXISTS products (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT,
  original_price       NUMERIC(12,2),
  discount_percentage  NUMERIC(5,2),
  image                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 6) PLACEMENT IMAGES (many → one PLACEMENT, each links to one PRODUCT)
-- Mirrors: placements[].images[{ name, anchor_position, position, product }]
CREATE TABLE IF NOT EXISTS placement_images (
  id               BIGSERIAL PRIMARY KEY,
  placement_id     BIGINT REFERENCES placements(id) ON DELETE CASCADE,
  name             TEXT,
  anchor_position  JSONB DEFAULT '{}'::jsonb,
  position         JSONB DEFAULT '{}'::jsonb,
  art_story_id     BIGINT REFERENCES art_stories(id) ON DELETE SET NULL,
  product_id       BIGINT REFERENCES products(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plimg_placement_id ON placement_images(placement_id);
CREATE INDEX IF NOT EXISTS idx_plimg_product_id   ON placement_images(product_id);

-- 7) ART STORIES (for creative storytelling)
CREATE TABLE IF NOT EXISTS art_stories (
  id      BIGSERIAL PRIMARY KEY,
  title   TEXT NOT NULL,
  image  TEXT,
  stories JSONB DEFAULT '[]'::jsonb
);