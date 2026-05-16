import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MyBooks from '../MyBooks'
import type { Book } from '../../types'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  token: 'test-token',
}

const publishedBook: Book = {
  id: 'book-1',
  title: 'Published Adventure',
  author: 'AI Author',
  description: 'A published story.',
  theme: 'adventure',
  age_range: '3-5',
  cover_emoji: '🦊',
  cover_color: '#ff6600',
  cover_url: null,
  price: 12.99,
  is_featured: 0,
  is_user_created: 1,
  status: 'published',
  version: 1,
  characters: [],
  style_descriptor: null,
  style_reference_url: null,
  created_by: 'user-1',
}

const unpublishedBook: Book = {
  ...publishedBook,
  status: 'draft',
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

interface FetchCall {
  url: string
  init?: RequestInit
}

function setupFetchMock(opts: {
  books?: Book[]
  unpublished?: Book
  unpublishStatus?: number
} = {}) {
  const calls: FetchCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    const method = init?.method ?? 'GET'

    if (url === '/api/books/mine' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.books ?? [publishedBook]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    if (url === '/api/books/book-1/unpublish' && method === 'PUT') {
      const status = opts.unpublishStatus ?? 200
      const body = status === 200 ? opts.unpublished ?? unpublishedBook : { error: 'failed' }
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
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

function renderMyBooks() {
  return render(
    <MemoryRouter>
      <MyBooks />
    </MemoryRouter>
  )
}

describe('MyBooks — Unpublish', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unpublishes a published book on confirm and flips the card to draft', async () => {
    const { calls } = setupFetchMock({})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMyBooks()

    // Card renders as Published initially.
    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument()
    })

    const unpublishBtn = screen.getByRole('button', { name: /unpublish book/i })
    fireEvent.click(unpublishBtn)

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    const confirmMessage = confirmSpy.mock.calls[0]?.[0] as string
    expect(confirmMessage).toMatch(/public catalog/i)
    expect(confirmMessage).toMatch(/draft/i)

    // Unpublish endpoint hit with the right URL + auth header.
    await waitFor(() => {
      const call = calls.find(c => c.url === '/api/books/book-1/unpublish')
      expect(call).toBeDefined()
      expect(call?.init?.method).toBe('PUT')
      const headers = call?.init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe('Bearer test-token')
    })

    // Card status badge flips to Draft after the response.
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
    expect(screen.queryByText('Published')).not.toBeInTheDocument()
    // And the Publish button (which only renders for drafts) is now present.
    expect(screen.getByRole('button', { name: /publish book/i })).toBeInTheDocument()
  })

  it('does not call the unpublish endpoint when the user cancels the confirm', async () => {
    const { calls } = setupFetchMock({})
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderMyBooks()

    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /unpublish book/i }))

    // No unpublish call should have been made.
    const unpublishCall = calls.find(c => c.url.includes('/unpublish'))
    expect(unpublishCall).toBeUndefined()
    // Card still shows Published.
    expect(screen.getByText('Published')).toBeInTheDocument()
  })
})
