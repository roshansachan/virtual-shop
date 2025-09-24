# GitHub Copilot Instructions for Virtual Shop

## Project Overview

Virtual Shop is a modern interactive design studio application built with Next.js 15 and TypeScript### Key Concepts

### Scenes and Assets
- **Scene**: A virtual environment with a background image and multiple asset folders
- **Folder**: Collections of images that can be placed on the canvas (one visible at a time)
- **PlacedImage**: Images positioned on the Konva canvas with x/y coordinates
- **Asset**: S3-stored images with metadata (key, size, lastModified, url)

### SceneRenderer Component
The `SceneRenderer` component is the core presentation layer that:
- Consumes scene configurations from `public/sceneConfig.json`
- Renders scenes with background images and positioned folder content
- **Folder Behavior**: Shows only one image per folder at the specified coordinates
- **Image Switching**: Provides UI for users to cycle through images within each folder
- **Coordinate System**: Uses x/y positioning data embedded in scene files
- **Responsive Rendering**: Maintains scene proportions across different screen sizes
- **Scene Scaling**: Document size matches exact background image dimensions; scales proportionally to fit viewport if background is too small
- **Smooth Navigation**: Users navigate the scene using smooth scroll functionality
- **Fixed Scale**: No pinch-to-zoom capability - scale is set initially and remains fixed

### State Managementlication allows users to create and manage virtual scenes with draggable images using Konva.js for canvas manipulation, with assets stored and managed via AWS S3.

### Project Vision

The project features an admin panel called **design-studio** where creators build interactive scenes:

- **Scenes**: Virtual environments with background images that serve as canvases for product placement
- **Folders**: Designated spots within scenes where collections of images can appear (one at a time)
- **Image Placement**: Each folder contains an array of images with x/y coordinates for precise positioning
- **Interactive Preview**: Users can view scenes with placed products in the main application

### Separation of Concerns

**Design Studio (`/design-studio`)**:
- Admin panel for creating and editing scene configurations
- Manages scene creation, folder setup, and image placement
- Handles S3 asset uploads and management
- Writes configuration files to `public/scenes/` directory
- Provides accurate scene preview matching the final render for editing purposes
- Should NOT handle final consumer-facing scene presentation

**Scene Renderer (`/` route)**:
- Consumer-facing interface that renders published scenes
- Uses `SceneRenderer` component to consume `public/sceneConfig.json`
- Displays interactive scenes with switchable folder images
- Should NOT handle scene editing or configuration management
- Focuses solely on presenting the final scene experience

**Key Principle**: Design Studio creates configs and provides editing previews, Scene Renderer consumes configs for final presentation. Scene preview and final render should always match to ensure consistency.

### Current Architecture & Planned Migration

**Current State (localStorage-based)**:
- Scene configurations stored in `localStorage` key `"virtualStoreScenes"`
- Image coordinates stored separately in `"virtualStoreImages"`
- Data structure mixing scene metadata with placement coordinates

**Planned Architecture (filesystem-based)**:
- Individual scene files: `public/scenes/scene-{index}.json`
- Consolidated scene data including image coordinates within each scene file
- Master index: `public/sceneConfig.json` listing all available scenes
- Elimination of separate coordinate storage for cleaner data architecture

### Current Data Structure

**virtualStoreScenes** contains scene metadata and folder structure:
```json
[{
  "id": "1758697331174",
  "name": "Living Room",
  "backgroundImage": "https://s3-url/background.png",
  "backgroundImageSize": {"width": 1248, "height": 832},
  "folders": [{
    "id": "1758697725332cov44aytf",
    "name": "Lamp",
    "expanded": true,
    "visible": true,
    "images": [{
      "id": "img-1758697816137",
      "name": "vase.png",
      "src": "https://s3-url/vase.png",
      "s3Key": "scenes/.../vase.png",
      "visible": true,
      "width": 100,
      "height": 100
    }]
  }],
  "backgroundImageS3Key": "scenes/.../background.png"
}]
```

**virtualStoreImages** contains placement coordinates:
```json
[{
  "id": "1758697816161ihwz5copk",
  "imageId": "img-1758697816137",
  "folderName": "Lamp",
  "src": "https://s3-url/vase.png",
  "x": 633.5,
  "y": 438,
  "width": 100,
  "height": 100,
  "name": "vase.png",
  "sceneId": "1758697331174"
}]
```

### Target Architecture

**Individual Scene Files** (`public/scenes/scene-{index}.json`):
```json
{
  "id": "1758697331174",
  "name": "Living Room",
  "backgroundImage": "https://s3-url/background.png",
  "backgroundImageSize": {"width": 1248, "height": 832},
  "backgroundImageS3Key": "scenes/.../background.png",
  "folders": [{
    "id": "1758697725332cov44aytf",
    "name": "Lamp",
    "expanded": true,
    "visible": true,
    "images": [{
      "id": "img-1758697816137",
      "name": "vase.png",
      "src": "https://s3-url/vase.png",
      "s3Key": "scenes/.../vase.png",
      "visible": true,
      "width": 100,
      "height": 100,
      "x": 633.5,
      "y": 438
    }]
  }]
}
```

**Master Scene Index** (`public/sceneConfig.json`):
```json
{
  "scenes": [
    {
      "index": 0,
      "id": "1758697331174",
      "name": "Living Room",
      "file": "scene-0.json"
    }
  ]
}
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Canvas/Graphics**: Konva.js with react-konva
- **Image Handling**: use-image hook
- **Cloud Storage**: AWS S3 SDK v3
- **Date Handling**: date-fns
- **Font**: Geist Sans and Geist Mono
- **Development**: ESLint 9.x

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints for S3 operations
│   │   ├── upload/        # Image upload to S3
│   │   ├── list-assets/   # List S3 assets
│   │   ├── delete-image/  # Delete S3 objects
│   │   ├── batch-assets/  # Batch operations on S3
│   │   └── upload-scene-background/  # Scene background uploads
│   ├── design-studio/     # Main design interface
│   └── page.tsx           # Home page with scene viewer
├── components/            # React components
│   └── AssetManager.tsx   # S3 asset management component
├── lib/                   # Utility libraries
│   ├── s3-config.ts       # AWS S3 configuration
│   ├── image-utils.ts     # Image processing utilities
│   └── utils.ts           # General utilities
└── types/                 # TypeScript type definitions
```

## Key Concepts

### Scenes and Assets
- **Scene**: A virtual environment with a background image and multiple asset folders
- **Folder**: Collections of images that can be placed on the canvas
- **PlacedImage**: Images positioned on the Konva canvas with x/y coordinates
- **Asset**: S3-stored images with metadata (key, size, lastModified, url)

### State Management
- Uses React useState/useCallback for local state
- localStorage for scene persistence
- Scene data structure includes folders, background images, and placed items

### Canvas Operations
- Konva.js Stage and Layer for rendering
- Drag and drop functionality for image placement
- Pan and zoom controls for navigation
- CORS handling for S3 images with fallback loading

## Development Guidelines

### Migration Strategy
When implementing the localStorage to filesystem migration:

1. **Data Consolidation**: Merge `virtualStoreImages` coordinate data into scene files
2. **File System Structure**: Create `public/scenes/` directory with indexed scene files
3. **API Endpoints**: Develop endpoints for scene CRUD operations on filesystem
4. **SceneRenderer Integration**: Update SceneRenderer to consume filesystem-based configs
5. **Backward Compatibility**: Maintain localStorage fallback during transition
6. **Data Validation**: Ensure scene data integrity during migration
7. **Separation Enforcement**: Ensure design-studio only writes configs, SceneRenderer only reads them

### Scene Management Patterns
```typescript
// Scene file structure
interface SceneFile {
  id: string;
  name: string;
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  backgroundImageS3Key?: string;
  folders: Array<{
    id: string;
    name: string;
    expanded: boolean;
    visible: boolean;
    images: Array<{
      id: string;
      name: string;
      src: string;
      s3Key: string;
      visible: boolean;
      width: number;
      height: number;
      x: number; // Consolidated from virtualStoreImages
      y: number; // Consolidated from virtualStoreImages
    }>;
  }>;
}

// Scene config index
interface SceneConfig {
  scenes: Array<{
    index: number;
    id: string;
    name: string;
    file: string;
  }>;
}
```

### Code Style
- Use TypeScript with strict typing
- Prefer functional components with hooks
- Use `useCallback` for event handlers to prevent unnecessary re-renders
- Follow Next.js App Router conventions for file-based routing
- Use Tailwind CSS classes for styling with the new v4 syntax

### Component Patterns
- Custom hooks for complex logic (e.g., `useImageLoader`)
- Suspense boundaries for client-side components
- Error boundaries and fallback states for image loading
- Prop interfaces defined inline or in types/index.ts

### API Route Patterns
```typescript
// Standard API response structure
return NextResponse.json({ 
  success: boolean,
  data?: any,
  error?: string 
}, { status: number });

// S3 operations with error handling
try {
  const s3Client = getS3Client();
  const result = await s3Client.send(command);
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('S3 operation failed:', error);
  return NextResponse.json({ 
    error: 'Operation failed' 
  }, { status: 500 });
}
```

### Image Handling
- Use CORS-enabled loading with fallback for S3 images
- Implement lazy loading and error states
- Support multiple image formats (JPEG, PNG, GIF, WebP)
- File size validation (max 10MB)
- Generate unique S3 keys with scene/folder organization

### Environment Variables
Required environment variables for AWS S3:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET_NAME`
- `AWS_REGION`

### Error Handling
- Graceful fallbacks for image loading failures
- User-friendly error messages for upload failures
- Console logging for debugging S3 operations
- Progress indicators for upload operations

## Naming Conventions

### Files and Directories
- Use kebab-case for page routes (`design-studio`)
- Use PascalCase for components (`AssetManager.tsx`)
- Use camelCase for utilities and configs (`s3-config.ts`)

### Variables and Functions
- Use camelCase for variables and functions
- Use descriptive names for handlers (`handleAssetSelect`, `toggleFolderVisibility`)
- Prefix boolean states with `is`, `has`, `show` (`isLoading`, `showDrawer`)
- Use `handle` prefix for event handlers
- Use `set` prefix for state setters

### Types and Interfaces
- Use PascalCase for type definitions
- Suffix interfaces with descriptive names (`AssetManagerProps`, `FolderImage`)
- Define props interfaces inline for simple components
- Use union types for controlled values (`'grid' | 'list'`)

## Performance Considerations

### Image Loading
- Implement progressive image loading
- Use Next.js Image component where appropriate
- Cache image dimensions to prevent layout shifts
- Implement proper cleanup in useEffect hooks

### Canvas Optimization
- Use Konva's batchDraw() for multiple updates
- Implement proper event delegation for canvas interactions
- Clean up event listeners and intervals
- Use refs for direct DOM/Canvas manipulation

### State Updates
- Batch state updates using functional updates
- Use React.memo for expensive components
- Implement proper dependency arrays for hooks
- Avoid inline object creation in render

## S3 Integration

### File Organization
```
bucket/
├── scenes/
│   └── {sceneId}/
│       ├── backgrounds/
│       └── folders/
│           └── {folderId}/
```

### Security
- Use presigned URLs for secure access
- Implement proper CORS configuration
- Validate file types and sizes on upload
- Handle authentication errors gracefully

## Testing Guidelines

### Component Testing
- Test image loading states and error conditions
- Verify drag and drop functionality
- Test asset management operations
- Mock S3 API calls in tests

### API Route Testing
- Test successful upload scenarios
- Verify error handling for invalid inputs
- Test S3 connection failures
- Validate response formats

## Deployment Considerations

### Environment Setup
- Configure AWS credentials securely
- Set up S3 bucket with proper CORS policy
- Use environment-specific configuration
- Implement proper error monitoring

### Build Optimization
- Enable Next.js image optimization
- Configure proper caching headers
- Optimize bundle size with dynamic imports
- Use proper TypeScript configuration for production builds

## Common Patterns to Follow

1. **Error Boundaries**: Wrap components that might fail with error boundaries
2. **Loading States**: Always provide loading indicators for async operations
3. **Type Safety**: Use TypeScript strictly, avoid `any` types
4. **Accessibility**: Include proper ARIA labels and keyboard navigation
5. **Performance**: Use React DevTools to identify performance bottlenecks
6. **Security**: Validate all inputs and sanitize user-generated content

## Code Review Checklist

- [ ] TypeScript errors resolved
- [ ] No console.error in production code
- [ ] Proper error handling implemented
- [ ] Loading states provided
- [ ] Cleanup functions for useEffect
- [ ] Proper dependency arrays
- [ ] Accessible markup and interactions
- [ ] Performance considerations addressed
- [ ] Security validations in place
- [ ] Tests updated/added for new functionality

This project focuses on creating an intuitive design studio experience with robust asset management and canvas manipulation capabilities. Always prioritize user experience, performance, and maintainability in your implementations.
