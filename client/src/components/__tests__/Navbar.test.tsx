import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar'
import type { CartItem } from '../../types'

const mockToggle = vi.fn()

vi.mock('../../context/CartContext', () => ({
  useCart: (): { items: CartItem[]; total: number; sessionId: string; addToCart: ReturnType<typeof vi.fn>; updateQuantity: ReturnType<typeof vi.fn>; removeFromCart: ReturnType<typeof vi.fn>; clearCart: ReturnType<typeof vi.fn>; fetchCart: ReturnType<typeof vi.fn> } => ({
    items: [
      {
        id: 1,
        book_id: 'book-1',
        quantity: 2,
        title: 'Test Book',
        price: 9.99,
        cover_emoji: '📖',
        cover_color: '#ff0000',
        author: 'Author',
      },
      {
        id: 2,
        book_id: 'book-2',
        quantity: 3,
        title: 'Another Book',
        price: 14.99,
        cover_emoji: '🌟',
        cover_color: '#00ff00',
        author: 'Author 2',
      },
    ],
    total: 64.95,
    sessionId: 'test-session',
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    fetchCart: vi.fn(),
  }),
}))

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    dark: false,
    toggle: mockToggle,
  }),
}))

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  it('renders the StoryBook brand', () => {
    renderNavbar()
    expect(screen.getByText('StoryBook')).toBeInTheDocument()
  })

  it('shows the correct cart badge count', () => {
    renderNavbar()
    // 2 + 3 = 5 total items
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('has a dark mode toggle button', () => {
    renderNavbar()
    const toggleButton = screen.getByLabelText('Toggle dark mode')
    expect(toggleButton).toBeInTheDocument()
  })

  it('renders Browse link', () => {
    renderNavbar()
    expect(screen.getByText('Browse')).toBeInTheDocument()
  })

  it('renders Create a Book link', () => {
    renderNavbar()
    expect(screen.getByText('Create a Book')).toBeInTheDocument()
  })
})
