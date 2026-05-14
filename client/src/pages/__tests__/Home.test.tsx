import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Home from '../Home'
import type { Book } from '../../types'

const mockBooks: Book[] = [
  {
    id: 'book-1',
    title: 'The Brave Little Fox',
    author: 'AI Author',
    description: 'A story about a courageous fox.',
    theme: 'adventure',
    age_range: '3-5',
    cover_emoji: '🦊',
    cover_color: '#ff6600',
    price: 12.99,
    is_featured: 1,
    is_user_created: 0,
  },
  {
    id: 'book-2',
    title: 'Kindness Kingdom',
    author: 'AI Author',
    description: 'A tale about kindness and friendship.',
    theme: 'kindness',
    age_range: '4-7',
    cover_emoji: '👑',
    cover_color: '#ffcc00',
    price: 14.99,
    is_featured: 0,
    is_user_created: 0,
  },
]

const mockThemes = ['adventure', 'kindness']

// Mock CartContext since BookCard uses it
vi.mock('../../context/CartContext', () => ({
  useCart: () => ({
    items: [],
    total: 0,
    sessionId: 'test-session',
    addToCart: vi.fn().mockResolvedValue(undefined),
    updateQuantity: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    fetchCart: vi.fn(),
  }),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the hero section with "Stories Made with Magic"', () => {
    // Mock fetch to return a fresh Response each time (Response body can only be consumed once)
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))
    )

    renderHome()
    expect(screen.getByText(/Stories Made with/)).toBeInTheDocument()
    expect(screen.getByText('Magic')).toBeInTheDocument()
  })

  it('renders book cards after fetching', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // /api/books
        return Promise.resolve(
          new Response(JSON.stringify(mockBooks), { headers: { 'Content-Type': 'application/json' } })
        )
      }
      // /api/books/themes
      return Promise.resolve(
        new Response(JSON.stringify(mockThemes), { headers: { 'Content-Type': 'application/json' } })
      )
    })

    renderHome()

    // The featured book appears in both "Featured Stories" and "All Books" sections,
    // so use getAllByText for the featured title.
    await waitFor(() => {
      expect(screen.getAllByText('The Brave Little Fox').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('Kindness Kingdom')).toBeInTheDocument()
  })

  it('renders theme filter buttons and filters books when clicked', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify(mockBooks), { headers: { 'Content-Type': 'application/json' } })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockThemes), { headers: { 'Content-Type': 'application/json' } })
      )
    })

    renderHome()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('The Brave Little Fox').length).toBeGreaterThanOrEqual(1)
    })

    // Theme filter buttons should be present
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'adventure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'kindness' })).toBeInTheDocument()

    // Click the "adventure" filter -- this hides featured section and filters All Books
    fireEvent.click(screen.getByRole('button', { name: 'adventure' }))

    // Only the adventure book should be visible; kindness book should be gone
    expect(screen.getAllByText('The Brave Little Fox').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Kindness Kingdom')).not.toBeInTheDocument()

    // Click "All" to reset the filter
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getAllByText('The Brave Little Fox').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Kindness Kingdom')).toBeInTheDocument()
  })
})
