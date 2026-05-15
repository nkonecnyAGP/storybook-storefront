import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, ChevronLeft, ChevronRight, Send, Loader2, RefreshCw, Paintbrush, Image, BookOpen, FileText } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import type { BookWithPages, Page } from '../types'
import BookSpread from '../components/BookSpread'

export default function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const { addToCart } = useCart()
  const { user } = useAuth()
  const [book, setBook] = useState<BookWithPages | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState('')
  const [illustrating, setIllustrating] = useState(false)
  const [illustrateError, setIllustrateError] = useState('')
  const [illustrationFeedback, setIllustrationFeedback] = useState('')
  const [illustrationVersions, setIllustrationVersions] = useState<string[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const [viewMode, setViewMode] = useState<'spread' | 'reader'>('spread')

  const fetchBook = () => {
    const headers: Record<string, string> = {}
    if (user?.token) headers['Authorization'] = `Bearer ${user.token}`
    fetch(`/api/books/${id}`, { headers })
      .then(r => r.json())
      .then((data: BookWithPages) => { setBook(data); setLoading(false) })
  }

  useEffect(() => { fetchBook() }, [id, user])

  if (loading) return <div className="text-center py-20 text-gray-400 text-lg">Loading...</div>
  if (!book) return <div className="text-center py-20 text-gray-400 text-lg">Book not found</div>

  const pages: Page[] = book.pages || []
  const page = pages[currentPage]
  const isOwner = user && book.created_by === user.id
  const isDraft = book.status === 'draft'

  const handleAdd = async () => {
    await addToCart(book.id)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleRevise = async (feedbackText?: string, newPageCount?: number) => {
    const text = (feedbackText ?? feedback).trim()
    if (!text || !user) return
    setRevising(true)
    setReviseError('')
    try {
      const body: { feedback: string; newPageCount?: number } = { feedback: text }
      if (typeof newPageCount === 'number') body.newPageCount = newPageCount
      const res = await fetch(`/api/books/${book.id}/revise`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Revision failed')
      }
      const updated = await res.json() as BookWithPages
      setBook(updated)
      setFeedback('')
      setCurrentPage(0)
    } catch (err) {
      setReviseError(err instanceof Error ? err.message : 'Revision failed')
    } finally {
      setRevising(false)
    }
  }

  const handlePublish = async () => {
    if (!user) return
    const res = await fetch(`/api/books/${book.id}/publish`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${user.token}` },
    })
    if (res.ok) {
      const updated = await res.json() as BookWithPages
      setBook({ ...book, ...updated })
    }
  }

  const handleIllustrate = async (pageNum?: number) => {
    if (!user) return
    setIllustrating(true)
    setIllustrateError('')
    try {
      const body: Record<string, unknown> = {}
      if (pageNum) {
        body.pageNumber = pageNum
        if (illustrationFeedback.trim()) body.feedback = illustrationFeedback.trim()
      }
      const res = await fetch(`/api/books/${book.id}/illustrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Illustration failed')
      }
      const updated = await res.json() as BookWithPages
      setBook(updated)
    } catch (err) {
      setIllustrateError(err instanceof Error ? err.message : 'Illustration failed')
    } finally {
      setIllustrating(false)
    }
  }

  const loadVersions = async (pageNum: number) => {
    if (!user || !book) return
    const res = await fetch(`/api/books/${book.id}/illustrations/${pageNum}`, {
      headers: { 'Authorization': `Bearer ${user.token}` },
    })
    if (res.ok) {
      const versions = await res.json() as string[]
      setIllustrationVersions(versions)
      setShowVersions(true)
    }
  }

  const revertIllustration = async (pageNum: number, url: string) => {
    if (!user || !book) return
    const res = await fetch(`/api/books/${book.id}/illustrations/${pageNum}/revert`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      const updated = await res.json() as BookWithPages
      setBook(updated)
      setShowVersions(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to={isOwner ? '/my-books' : '/'} className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 mb-6 no-underline font-semibold">
        <ArrowLeft size={18} /> {isOwner ? 'Back to My Books' : 'Back to catalog'}
      </Link>

      {/* Book Header */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg overflow-hidden mb-8 transition-colors">
        <div className="md:flex">
          <div
            className="md:w-1/3 h-64 md:h-auto flex items-center justify-center text-8xl relative"
            style={{ backgroundColor: book.cover_color + '20' }}
          >
            <span className="drop-shadow-xl">{book.cover_emoji}</span>
            {isOwner && (
              <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full ${
                isDraft
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
              }`}>
                {isDraft ? 'Draft' : 'Published'} &middot; v{book.version}
              </span>
            )}
          </div>
          <div className="p-8 md:w-2/3">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">{book.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-1">by {book.author}</p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{book.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full font-semibold">
                Ages {book.age_range}
              </span>
              <span className="text-sm bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-semibold capitalize">
                {book.theme}
              </span>
              {book.is_user_created ? (
                <span className="text-sm bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 px-3 py-1 rounded-full font-semibold">
                  AI Generated
                </span>
              ) : null}
            </div>
            {book.characters && book.characters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 self-center mr-1">Cast:</span>
                {book.characters.map((c, i) => {
                  const tone =
                    c.role === 'primary' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                    c.role === 'antagonist' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' :
                    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                  return (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${tone}`} title={c.descriptor || c.relationship || c.role}>
                      {c.name}
                      {c.relationship ? ` · ${c.relationship}` : ''}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-3">
              {isDraft && isOwner && (
                <>
                  <button
                    onClick={() => void handlePublish()}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white transition-colors cursor-pointer"
                  >
                    <Send size={16} />
                    Publish
                  </button>
                  <button
                    onClick={() => void handleIllustrate()}
                    disabled={illustrating || pages.every(p => p.illustration_url)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-purple-500 hover:bg-purple-600 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                  >
                    {illustrating ? <Loader2 size={16} className="animate-spin" /> : <Paintbrush size={16} />}
                    {illustrating ? 'Illustrating...' : 'Illustrate All'}
                  </button>
                </>
              )}
              {illustrateError && (
                <span className="text-sm text-red-500">{illustrateError}</span>
              )}
              {!isDraft && (
                <>
                  <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">${book.price.toFixed(2)}</span>
                  <button
                    onClick={() => void handleAdd()}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                      added
                        ? 'bg-green-500 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    <ShoppingCart size={18} />
                    {added ? 'Added!' : 'Add to Cart'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View mode toggle */}
      {pages.length > 0 && (
        <div className="flex justify-end mb-3">
          <div className="inline-flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('spread')}
              aria-pressed={viewMode === 'spread'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${
                viewMode === 'spread'
                  ? 'bg-amber-500 text-white'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen size={14} /> Book view
            </button>
            <button
              onClick={() => setViewMode('reader')}
              aria-pressed={viewMode === 'reader'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${
                viewMode === 'reader'
                  ? 'bg-amber-500 text-white'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-gray-700'
              }`}
            >
              <FileText size={14} /> Reader view
            </button>
          </div>
        </div>
      )}

      {/* Book spread view */}
      {viewMode === 'spread' && pages.length > 0 && (
        <BookSpread
          book={book}
          isOwner={!!isOwner}
          isDraft={isDraft}
          illustrating={illustrating}
          onIllustratePage={async (pageNum, fb) => {
            if (fb !== undefined) setIllustrationFeedback(fb)
            await handleIllustrate(pageNum)
          }}
          onRevise={handleRevise}
          revising={revising}
          reviseError={reviseError}
        />
      )}

      {/* Page Reader (legacy reader view) */}
      {viewMode === 'reader' && pages.length > 0 && page && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 transition-colors mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-6">Read the Story</h2>

          <div className="bg-amber-50 dark:bg-gray-700/50 rounded-2xl p-8 min-h-[300px] flex flex-col justify-between transition-colors">
            <div>
              <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold mb-4">
                Page {currentPage + 1} of {pages.length}
              </div>

              {page.illustration_url && (
                <div className="mb-6">
                  <div className="rounded-xl overflow-hidden shadow-md">
                    <img
                      src={`http://localhost:3001${page.illustration_url}`}
                      alt={page.illustration_description}
                      className="w-full h-auto"
                    />
                  </div>
                  {isOwner && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={illustrationFeedback}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIllustrationFeedback(e.target.value)}
                          placeholder="e.g., make the colors warmer, add more stars..."
                          disabled={illustrating}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:border-purple-400 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                        />
                        <button
                          onClick={() => { void handleIllustrate(page.page_number); setIllustrationFeedback('') }}
                          disabled={illustrating}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 cursor-pointer border-none disabled:opacity-40 whitespace-nowrap"
                        >
                          {illustrating ? <Loader2 size={14} className="animate-spin" /> : <Paintbrush size={14} />}
                          Regenerate
                        </button>
                        <button
                          onClick={() => void loadVersions(page.page_number)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer border-none whitespace-nowrap"
                        >
                          History
                        </button>
                      </div>
                      {showVersions && illustrationVersions.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {illustrationVersions.map((url, i) => (
                            <button
                              key={url}
                              onClick={() => void revertIllustration(page.page_number, url)}
                              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer ${
                                url === page.illustration_url
                                  ? 'border-purple-500'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                              }`}
                            >
                              <img src={`http://localhost:3001${url}`} alt={`Version ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xl text-gray-700 dark:text-gray-200 leading-relaxed mb-6">{page.text}</p>

              {page.illustration_description && !page.illustration_url && (
                <div className="bg-white/60 dark:bg-gray-600/40 rounded-xl p-4 border border-amber-200 dark:border-gray-600 flex items-start gap-3">
                  <Image size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-amber-700 dark:text-amber-300 italic">
                      {page.illustration_description}
                    </p>
                    {isOwner && (
                      <button
                        onClick={() => void handleIllustrate(page.page_number)}
                        disabled={illustrating}
                        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 cursor-pointer bg-transparent border-none disabled:opacity-40"
                      >
                        <Paintbrush size={13} />
                        {illustrating ? 'Generating...' : 'Generate illustration'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-8">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default bg-white dark:bg-gray-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-gray-500"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <div className="flex gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${
                      i === currentPage ? 'bg-amber-500' : 'bg-amber-200 dark:bg-gray-500 hover:bg-amber-300 dark:hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === pages.length - 1}
                className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default bg-white dark:bg-gray-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-gray-500"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Panel — only for draft books owned by user */}
      {isOwner && isDraft && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 transition-colors">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">
            <RefreshCw size={22} className="inline mr-2 text-purple-500" />
            Revise Your Story
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Read through the story above, then describe what you'd like changed. Our AI author will create a revised version.
          </p>

          <textarea
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            placeholder="e.g., Make the ending happier, change the dragon to a unicorn, page 3 is too scary for young kids..."
            disabled={revising}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-400 focus:outline-none text-base h-28 resize-none placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
            maxLength={1000}
          />

          {reviseError && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-xl mt-3 text-sm">
              {reviseError}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {feedback.length}/1000
            </span>
            <button
              onClick={() => void handleRevise()}
              disabled={revising || !feedback.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-shadow cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              {revising ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Revising...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Revise Story
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
