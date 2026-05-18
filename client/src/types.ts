export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  token: string;
  role: UserRole;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  deleted_at: string | null;
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
  created_at?: string;
  deleted_at?: string | null;
}

export interface BookWithPages extends Book {
  pages: Page[];
}

export interface AdminBook extends Book {
  deleted_at: string | null;
  creator: { email: string; name: string } | null;
}

export interface OrphanIllustration {
  path: string;
  book_exists: boolean;
  soft_deleted: boolean;
}

export interface Page {
  id: number;
  book_id: string;
  page_number: number;
  text: string;
  illustration_description: string;
  illustration_url: string | null;
}

// CartItem, Order, and OrderItem are sourced from @storybook/shared (Zod schemas).
// Do not redeclare them here — see shared/src/cart.ts and shared/src/orders.ts.
// Re-exported so existing in-client consumers can keep importing from '../types'.
// `OrderSummary` was historically a near-duplicate of the wire `Order` shape; it
// has been retired in favor of `Order` itself (single source of truth for the
// wire shape). Consumers can ignore fields they don't render (e.g. session_id).
export type { CartItem } from '@storybook/shared';
export type { Order, OrderItem } from '@storybook/shared';

export interface IllustrationVersion {
  url: string;
  version: number;
  created_at: string;
  feedback: string | null;
}

export interface BookVersion {
  id: number;
  book_id: string;
  version: number;
  pages_json: string;
  description: string | null;
  characters_json: string | null;
  created_at: string;
  pages: Array<{
    page_number: number;
    text: string;
    illustrationDescription: string;
  }>;
}
