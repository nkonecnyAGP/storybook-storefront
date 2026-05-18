import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Admin from '../Admin'
import type { AdminUser, AdminBook, OrphanIllustration, User } from '../../types'

const adminUser: User = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  token: 'admin-token',
  role: 'admin',
}

const regularUser: User = {
  id: 'user-2',
  email: 'user@example.com',
  name: 'Regular User',
  token: 'user-token',
  role: 'user',
}

let currentUser: User | null = adminUser
let currentAuthLoading = false

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    loading: currentAuthLoading,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

const sampleUsers: AdminUser[] = [
  {
    id: 'u-1',
    email: 'active@example.com',
    name: 'Active User',
    role: 'user',
    deleted_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'u-2',
    email: 'deleted@example.com',
    name: 'Deleted User',
    role: 'user',
    deleted_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

const sampleBooks: AdminBook[] = [
  {
    id: 'b-1',
    title: 'Featured Book',
    author: 'Author',
    description: 'desc',
    theme: 'adventure',
    age_range: '3-5',
    cover_emoji: '🦊',
    cover_color: '#ff6600',
    cover_url: null,
    price: 9.99,
    is_featured: true,
    is_user_created: false,
    status: 'published',
    version: 1,
    characters: [],
    characters_json: null,
    style_descriptor: null,
    style_reference_url: null,
    created_by: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
    creator: null,
  },
  {
    id: 'b-2',
    title: 'Unfeatured Book',
    author: 'Other Author',
    description: 'desc2',
    theme: 'friendship',
    age_range: '3-5',
    cover_emoji: '🐻',
    cover_color: '#cc66ff',
    cover_url: null,
    price: 11.99,
    is_featured: false,
    is_user_created: true,
    status: 'published',
    version: 1,
    characters: [],
    characters_json: null,
    style_descriptor: null,
    style_reference_url: null,
    created_by: 'creator-id',
    created_at: new Date().toISOString(),
    deleted_at: null,
    creator: { email: 'creator@example.com', name: 'Creator' },
  },
]

const sampleOrphans: OrphanIllustration[] = [
  { path: '/illustrations/orphan-1', book_exists: false, soft_deleted: false },
]

interface FetchCall {
  url: string
  init?: RequestInit
}

function setupFetchMock(opts: {
  users?: AdminUser[]
  books?: AdminBook[]
  orphans?: OrphanIllustration[]
  restoredUser?: AdminUser
  restoredBook?: AdminBook
  featuredBook?: AdminBook
} = {}) {
  const calls: FetchCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    const method = init?.method ?? 'GET'

    if (url === '/api/admin/users' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.users ?? sampleUsers), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (url === '/api/admin/books' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.books ?? sampleBooks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (url === '/api/admin/orphan-illustrations' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.orphans ?? sampleOrphans), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (/^\/api\/admin\/users\/[^/]+\/restore$/.test(url) && method === 'PUT') {
      const id = url.split('/')[4]!
      const restored: AdminUser =
        opts.restoredUser ?? { ...sampleUsers[1]!, id, deleted_at: null }
      return Promise.resolve(
        new Response(JSON.stringify(restored), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (/^\/api\/admin\/books\/[^/]+\/restore$/.test(url) && method === 'PUT') {
      return Promise.resolve(
        new Response(JSON.stringify(opts.restoredBook ?? sampleBooks[0]!), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (/^\/api\/admin\/books\/[^/]+\/featured$/.test(url) && method === 'PUT') {
      const id = url.split('/')[4]!
      const found = (opts.books ?? sampleBooks).find(b => b.id === id) ?? sampleBooks[0]!
      const body = init?.body ? (JSON.parse(init.body as string) as { is_featured: boolean }) : { is_featured: false }
      const updated: AdminBook = opts.featuredBook ?? { ...found, is_featured: body.is_featured }
      return Promise.resolve(
        new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: `unmocked ${method} ${url}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
  return { calls }
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<div data-testid="login-page">login</div>} />
        <Route path="/" element={<div data-testid="home-page">home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Admin page', () => {
  beforeEach(() => {
    currentUser = adminUser
    currentAuthLoading = false
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders three tabs and the populated Users table for an admin', async () => {
    setupFetchMock()
    renderAdmin()

    // All three tabs are rendered.
    expect(screen.getByRole('button', { name: /^Users/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Books/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Orphans/ })).toBeInTheDocument()

    // Users table populated from mocked fetch.
    await waitFor(() => {
      expect(screen.getByText('active@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText('deleted@example.com')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    // Status badge contains "Deleted {relative time}" (e.g. "Deleted 30m ago").
    expect(screen.getByText(/Deleted \d+m ago/)).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', async () => {
    currentUser = null
    setupFetchMock()
    renderAdmin()

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('redirects to / when authenticated but role is not admin', async () => {
    currentUser = regularUser
    setupFetchMock()
    renderAdmin()

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  it('restores a soft-deleted user on confirm and updates local state', async () => {
    const { calls } = setupFetchMock()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAdmin()

    await waitFor(() => {
      expect(screen.getByText('deleted@example.com')).toBeInTheDocument()
    })

    const restoreBtn = screen.getByRole('button', { name: /Restore user deleted@example\.com/i })
    await act(async () => {
      fireEvent.click(restoreBtn)
    })
    expect(confirmSpy).toHaveBeenCalledTimes(1)

    // Right URL + auth header.
    await waitFor(() => {
      const call = calls.find(c => c.url === '/api/admin/users/u-2/restore')
      expect(call).toBeDefined()
      expect(call?.init?.method).toBe('PUT')
      const headers = call?.init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe('Bearer admin-token')
    })

    // The "Deleted" status badge for that row should be gone — replaced with Active.
    await waitFor(() => {
      const activeCells = screen.getAllByText('Active')
      // Both users now Active (was 1, now 2).
      expect(activeCells.length).toBe(2)
    })
  })

  it('toggles featured for a book — fires PUT with inverted value and updates local state', async () => {
    const { calls } = setupFetchMock()
    renderAdmin()

    // Switch to Books tab.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Books/ })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Books/ }))

    await waitFor(() => {
      expect(screen.getByText('Featured Book')).toBeInTheDocument()
    })

    // Featured Book (is_featured: 1) — button has unfeature label.
    const unfeatureBtn = screen.getByRole('button', { name: /Unfeature Featured Book/i })
    await act(async () => {
      fireEvent.click(unfeatureBtn)
    })

    await waitFor(() => {
      const call = calls.find(c => c.url === '/api/admin/books/b-1/featured')
      expect(call).toBeDefined()
      expect(call?.init?.method).toBe('PUT')
      const body = JSON.parse(call?.init?.body as string) as { is_featured: boolean }
      expect(body.is_featured).toBe(false)
    })

    // After update, that book should now be unfeatured (button label flips).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Feature Featured Book/i })).toBeInTheDocument()
    })
  })
})
