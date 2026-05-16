import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import BookDetail from '../BookDetail'
import type { BookWithPages, BookVersion } from '../../types'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  token: 'test-token',
}

const baseBook: BookWithPages = {
  id: 'book-1',
  title: 'Test Adventure',
  author: 'AI Author',
  description: 'A test adventure story.',
  theme: 'adventure',
  age_range: '3-5',
  cover_emoji: '🦊',
  cover_color: '#ff6600',
  cover_url: null,
  price: 12.99,
  is_featured: 0,
  is_user_created: 1,
  status: 'draft',
  version: 3,
  characters: [],
  style_descriptor: null,
  style_reference_url: null,
  created_by: 'user-1',
  pages: [
    { id: 1, book_id: 'book-1', page_number: 1, text: 'Page 1 current', illustration_description: 'desc 1', illustration_url: null },
    { id: 2, book_id: 'book-1', page_number: 2, text: 'Page 2 current', illustration_description: 'desc 2', illustration_url: null },
  ],
}

const restoredBook: BookWithPages = {
  ...baseBook,
  version: 4,
  pages: [
    { id: 10, book_id: 'book-1', page_number: 1, text: 'Restored page 1', illustration_description: 'old desc 1', illustration_url: null },
    { id: 11, book_id: 'book-1', page_number: 2, text: 'Restored page 2', illustration_description: 'old desc 2', illustration_url: null },
  ],
}

const versionsResponse: BookVersion[] = [
  {
    id: 30,
    book_id: 'book-1',
    version: 3,
    pages_json: '[]',
    description: null,
    characters_json: null,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    pages: [
      { page_number: 1, text: 'v3 page 1', illustrationDescription: 'd1' },
      { page_number: 2, text: 'v3 page 2', illustrationDescription: 'd2' },
    ],
  },
  {
    id: 20,
    book_id: 'book-1',
    version: 2,
    pages_json: '[]',
    description: null,
    characters_json: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    pages: [
      { page_number: 1, text: 'v2 page 1', illustrationDescription: 'd1' },
      { page_number: 2, text: 'v2 page 2', illustrationDescription: 'd2' },
    ],
  },
  {
    id: 10,
    book_id: 'book-1',
    version: 1,
    pages_json: '[]',
    description: null,
    characters_json: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    pages: [
      { page_number: 1, text: 'v1 page 1', illustrationDescription: 'd1' },
      { page_number: 2, text: 'v1 page 2', illustrationDescription: 'd2' },
    ],
  },
]

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

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

// BookSpread imports its own deps; mock to keep the test focused on the
// version-history flow rather than the spread renderer.
vi.mock('../../components/BookSpread', () => ({
  default: () => <div data-testid="book-spread" />,
}))

function renderBookDetail() {
  return render(
    <MemoryRouter initialEntries={['/book/book-1']}>
      <Routes>
        <Route path="/book/:id" element={<BookDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

interface FetchCall {
  url: string
  init?: RequestInit
}

function setupFetchMock(opts: {
  book?: BookWithPages
  versions?: BookVersion[]
  restored?: BookWithPages
  illustrationVersions?: string[]
}) {
  const calls: FetchCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    const method = init?.method ?? 'GET'

    if (url === '/api/books/book-1' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.book ?? baseBook), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    if (url === '/api/books/book-1/versions' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.versions ?? versionsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    if (/^\/api\/books\/book-1\/versions\/\d+\/restore$/.test(url) && method === 'PUT') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.restored ?? restoredBook), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    if (/^\/api\/books\/book-1\/illustrations\/\d+$/.test(url) && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.illustrationVersions ?? []), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: `unmocked ${method} ${url}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })
  return { calls }
}

describe('BookDetail — Version History', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the version history section with prior versions for an owned draft', async () => {
    setupFetchMock({})
    renderBookDetail()

    await waitFor(() => {
      expect(screen.getByText('Version history')).toBeInTheDocument()
    })

    // versionsResponse has v3, v2, v1. v3 is the current draft and should be
    // hidden from the list. v2 and v1 should be the only restorable rows.
    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument()
    })
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.queryByText('v3')).not.toBeInTheDocument()

    // Two restore buttons, one per prior version.
    expect(screen.getAllByRole('button', { name: /restore version/i })).toHaveLength(2)
  })

  it('shows the empty state when only the current version exists', async () => {
    setupFetchMock({ versions: [versionsResponse[0]!] })
    renderBookDetail()

    await waitFor(() => {
      expect(screen.getByText(/no previous versions yet/i)).toBeInTheDocument()
    })
  })

  it('restores a prior version after confirmation and updates book state', async () => {
    const { calls } = setupFetchMock({})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderBookDetail()

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })

    // Click "Restore" on v1 (the oldest version).
    const restoreV1 = screen.getByRole('button', { name: /restore version 1/i })
    fireEvent.click(restoreV1)

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    const confirmMessage = confirmSpy.mock.calls[0]?.[0] as string
    expect(confirmMessage).toMatch(/illustration/i)
    expect(confirmMessage).toMatch(/cleared/i)

    // Restore endpoint hit with the right URL + auth header.
    await waitFor(() => {
      const restoreCall = calls.find(c => c.url === '/api/books/book-1/versions/1/restore')
      expect(restoreCall).toBeDefined()
      expect(restoreCall?.init?.method).toBe('PUT')
      const headers = restoreCall?.init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe('Bearer test-token')
    })

    // Book state should reflect the restored book — restored pages text shows
    // up (we render reader view which displays page text).
    fireEvent.click(screen.getByRole('button', { name: /reader view/i }))
    await waitFor(() => {
      expect(screen.getByText('Restored page 1')).toBeInTheDocument()
    })

    // Versions list should be re-fetched after restore (one initial GET, then
    // one after restore = at least 2 GETs to /versions).
    const versionsGets = calls.filter(c => c.url === '/api/books/book-1/versions' && (c.init?.method ?? 'GET') === 'GET')
    expect(versionsGets.length).toBeGreaterThanOrEqual(2)
  })

  it('does not call the restore endpoint when the user cancels the confirm', async () => {
    const { calls } = setupFetchMock({})
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderBookDetail()

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))

    // No restore call should have been made.
    const restoreCall = calls.find(c => c.url.includes('/restore'))
    expect(restoreCall).toBeUndefined()
  })
})

describe('BookDetail — Illustration history active indicator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const currentUrl = '/uploads/illustrations/current.png'
  const olderUrl = '/uploads/illustrations/older.png'

  const illustratedBook: BookWithPages = {
    ...baseBook,
    pages: [
      {
        id: 1,
        book_id: 'book-1',
        page_number: 1,
        text: 'Page 1 text',
        illustration_description: 'desc 1',
        illustration_url: currentUrl,
      },
      {
        id: 2,
        book_id: 'book-1',
        page_number: 2,
        text: 'Page 2 text',
        illustration_description: 'desc 2',
        illustration_url: null,
      },
    ],
  }

  it('marks the active thumbnail with a "Current" badge and renders non-active as revert buttons', async () => {
    setupFetchMock({
      book: illustratedBook,
      illustrationVersions: [currentUrl, olderUrl],
    })

    renderBookDetail()

    // Switch to reader view (mocked BookSpread covers default 'spread' view).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reader view/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /reader view/i }))

    // Page 1 has an illustration; History button should be available.
    const historyBtn = await screen.findByRole('button', { name: /^history$/i })
    fireEvent.click(historyBtn)

    // After load, the carousel should render. The current thumbnail is the
    // one whose URL equals page.illustration_url -> it gets the "Current"
    // badge and is NOT a button. The older one IS a button.
    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument()
    })

    // Non-active should be a button labelled "Revert to version 2".
    expect(screen.getByRole('button', { name: /revert to version 2/i })).toBeInTheDocument()

    // The active version should NOT be a button (so clicking the already-
    // active version is a no-op / not even rendered as one).
    expect(screen.queryByRole('button', { name: /revert to version 1/i })).not.toBeInTheDocument()
  })
})
