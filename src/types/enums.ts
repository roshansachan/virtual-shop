// Database enums based on db.sql

// Scene Type Enum - values for scenes.type column
export enum SceneType {
  HOME = 'home',
  STREET = 'street'
}

// Theme Type Enum - values for themes.theme_type column
export enum ThemeType {
  CITY = 'city',
    OCCASION = 'occasion'
}

// Type aliases for easier usage
export type SceneTypeValue = `${SceneType}`;
export type ThemeTypeValue = `${ThemeType}`;