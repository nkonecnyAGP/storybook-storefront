import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'

export default function BookDetail() {
  const { id } = useParams()
  const { addToCart } = useCart()
  const [book, setBook] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    fetch(`/api/books/${id}`)
      .then(r => r.json())
      .then(data => { setBook(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="text-center py-20 text-gray-400 text-lg">Loading...</div>
  if (!book) return <div className="text-center py-20 text-gray-400 text-lg">Book not found</div>

  const pages = book.pages || []
  const page = pages[currentPage]

  const handleAdd = async () => {
    await addToCart(book.id)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 mb-6 no-underline font-semibold">
        <ArrowLeft size={18} /> Back to catalog
      </Link>

      {/* Book Header */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg overflow-hidden mb-8 transition-colors">
        <div className="md:flex">
          <div
            className="md:w-1/3 h-64 md:h-auto flex items-center justify-center text-8xl"
            style={{ backgroundColor: book.cover_color + '20' }}
          >
            <span className="drop-shadow-xl">{book.cover_emoji}</span>
          </div>
          <div className="p-8 md:w-2/3">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">{book.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-1">by {book.author}</p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{book.description}</p>
            <div className="flex gap-2 mb-4">
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
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">${book.price.toFixed(2)}</span>
              <button
                onClick={handleAdd}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                  added
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                <ShoppingCart size={18} />
                {added ? 'Added!' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Page Reader */}
      {pages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 transition-colors">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-6">Read the Story</h2>

          <div className="bg-amber-50 dark:bg-gray-700/50 rounded-2xl p-8 min-h-[300px] flex flex-col justify-between transition-colors">
            <div>
              <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold mb-4">
                Page {currentPage + 1} of {pages.length}
              </div>
              <p className="text-xl text-gray-700 dark:text-gray-200 leading-relaxed mb-6">{page.text}</p>
              {page.illustration_description && (
                <div className="bg-white/60 dark:bg-gray-600/40 rounded-xl p-4 border border-amber-200 dark:border-gray-600">
                  <p className="text-sm text-amber-700 dark:text-amber-300 italic">
                    <span className="font-semibold not-italic">Illustration: </span>
                    {page.illustration_description}
                  </p>
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
    </div>
  )
}
