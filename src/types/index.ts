// Scene and related types for SceneRenderer components
export interface FolderImage {
  id: string
  name: string
  src: string
  s3Key: string
  visible: boolean
  width: number
  height: number
  x: number
  y: number
}

export interface Folder {
  id: string
  name: string
  expanded: boolean
  visible: boolean
  images: FolderImage[]
}

export interface Scene {
  id: string
  name: string
  backgroundImage: string
  backgroundImageSize: { width: number; height: number }
  backgroundImageS3Key?: string
  folders: Folder[]
}

export interface SceneConfig {
  scenes: Array<{
    index: number
    id: string
    name: string
    file: string
  }>
}

// export interface Product {
//   id: string;
//   name: string;
//   description: string;
//   price: number;
//   images: string[];
//   category: string;
//   stock: number;
//   featured: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// export interface CartItem {
//   id: string;
//   productId: string;
//   quantity: number;
//   price: number;
// }

// export interface User {
//   id: string;
//   email: string;
//   name: string;
//   role: 'admin' | 'customer';
//   createdAt: Date;
// }

// export interface Order {
//   id: string;
//   userId: string;
//   items: CartItem[];
//   total: number;
//   status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
//   createdAt: Date;
//   updatedAt: Date;
// }