import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BookCard from '../components/BookCard'
import type { Book } from '../types'

export default function MyBooks() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/books/mine', {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(res => res.json())
      .then((data: Book[]) => setBooks(data))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <BookOpen size={64} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">Sign in to see your books</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Create an account to track all the stories you create.</p>
        <Link
          to="/login"
          className="inline-block bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold no-underline transition-colors"
        >
          Sign In
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-lg">Loading your books...</div>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Sparkles size={64} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">No books yet</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first personalized story with AI!</p>
        <Link
          to="/create"
          className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold no-underline transition-shadow hover:shadow-lg"
        >
          Create a Book
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-display">My Books</h1>
        <Link
          to="/create"
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full flex items-center gap-1.5 no-underline font-semibold hover:shadow-lg transition-shadow text-sm"
        >
          <Sparkles size={16} />
          Create Another
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map(book => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  )
}
