import { Link } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'

export default function Cart() {
  const { items, total, updateQuantity, removeFromCart } = useCart()

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">Your cart is empty</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Time to find some magical stories!</p>
        <Link
          to="/"
          className="inline-block bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold no-underline transition-colors"
        >
          Browse Books
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-display mb-6">Your Cart</h1>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.book_id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex items-center gap-4 transition-colors">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: (item.cover_color || '#6366f1') + '20' }}
            >
              {item.cover_emoji}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/book/${item.book_id}`} className="font-bold text-gray-800 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 no-underline">
                {item.title}
              </Link>
              <div className="text-gray-500 dark:text-gray-400 text-sm">${item.price?.toFixed(2)} each</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.book_id, item.quantity - 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center cursor-pointer transition-colors text-gray-700 dark:text-gray-300"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center font-bold text-gray-800 dark:text-gray-100">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.book_id, item.quantity + 1)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center cursor-pointer transition-colors text-gray-700 dark:text-gray-300"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="text-right w-20">
              <div className="font-bold text-gray-800 dark:text-gray-100">${(item.price * item.quantity).toFixed(2)}</div>
            </div>
            <button
              onClick={() => removeFromCart(item.book_id)}
              className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mt-6 transition-colors">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">Total</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">${total.toFixed(2)}</span>
        </div>
        <Link
          to="/checkout"
          className="block w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-center no-underline transition-colors"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  )
}
