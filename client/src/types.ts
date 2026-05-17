export interface User {
  id: string;
  email: string;
  name: string;
  token: string;
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
}

export interface BookWithPages extends Book {
  pages: Page[];
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
  book_id: string;
  quantity: number;
  title: string;
  price: number;
  cover_emoji: string;
  cover_color: string;
  author: string;
}

export interface OrderSummary {
  id: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: string;
  items: OrderItem[];
  created_at?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: string;
  book_id: string;
  book_title: string;
  quantity: number;
  price: number;
}

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
