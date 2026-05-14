export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  token: string | null;
  created_at: string;
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
  status: string;
  version: number;
  created_by: string | null;
  created_at: string;
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
  session_id: string;
  book_id: string;
  quantity: number;
}

export interface Order {
  id: string;
  session_id: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: string;
  book_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Store {
  users: User[];
  books: Book[];
  pages: Page[];
  cartItems: CartItem[];
  orders: Order[];
  orderItems: OrderItem[];
}
