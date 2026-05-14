import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import BookCard from '../components/BookCard'
import type { Book } from '../types'

export default function Home() {
  const [books, setBooks] = useState<Book[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/books').then(r => r.json()) as Promise<Book[]>,
      fetch('/api/books/themes').then(r => r.json()) as Promise<string[]>,
    ]).then(([booksData, themesData]) => {
      setBooks(booksData)
      setThemes(themesData)
      setLoading(false)
    })
  }, [])

  const filtered = activeTheme ? books.filter(b => b.theme === activeTheme) : books
  const featured = books.filter(b => b.is_featured)

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-purple-50 to-amber-50 dark:from-gray-800 dark:to-gray-900 py-16 px-4 text-center transition-colors">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 dark:text-gray-100 mb-4 font-display">
          Stories Made with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">Magic</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
          Beautiful children's books crafted by AI. Browse our collection or create a one-of-a-kind story for your little one.
        </p>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:shadow-xl transition-shadow no-underline"
        >
          <Sparkles size={20} />
          Create Your Own Book
        </Link>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Featured */}
        {!activeTheme && featured.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6 font-display">Featured Stories</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map(book => <BookCard key={book.id} book={book} />)}
            </div>
          </section>
        )}

        {/* Browse All */}
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-display mr-4">All Books</h2>
            <button
              onClick={() => setActiveTheme(null)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                !activeTheme ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {themes.map(theme => (
              <button
                key={theme}
                onClick={() => setActiveTheme(theme)}
                className={`px-3 py-1 rounded-full text-sm font-semibold capitalize transition-colors cursor-pointer ${
                  activeTheme === theme ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-400 text-lg">Loading books...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filtered.map(book => <BookCard key={book.id} book={book} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
