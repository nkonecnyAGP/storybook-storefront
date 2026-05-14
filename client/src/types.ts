export interface User {
  id: string;
  email: string;
  name: string;
  token: string;
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
  price: number;
  is_featured: number;
  is_user_created: number;
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
