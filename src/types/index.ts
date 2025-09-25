// export interface Placement {
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