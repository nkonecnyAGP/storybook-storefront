import type { Order, OrderItem } from '@storybook/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  token: string | null;
  created_at: string;
}

export type CharacterRole = 'primary' | 'antagonist' | 'supporting';

export interface Character {
  role: CharacterRole;
  name: string;
  descriptor?: string;
  relationship?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  theme: string;
  age_range: string;
  cover_emoji: string;
  cover_color: string;
  cover_url: string | null;
  price: number;
  is_featured: number;
  is_user_created: number;
  status: string;
  version: number;
  characters: Character[];
  style_descriptor: string | null;
  style_reference_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Page {
  id: number;
  book_id: string;
  page_number: number;
  text: string;
  illustration_description: string;
  illustration_url: string | null;
}

export interface CartItem {
  id: number;
  session_id: string;
  book_id: string;
  quantity: number;
}

// Order and OrderItem are sourced from @storybook/shared (Zod schemas).
// Do not redeclare them here — see shared/src/orders.ts.
// Re-exported so existing in-server consumers can keep importing from '../types'.
export type { Order, OrderItem } from '@storybook/shared';

export interface Store {
  users: User[];
  books: Book[];
  pages: Page[];
  cartItems: CartItem[];
  orders: Order[];
  orderItems: OrderItem[];
}
