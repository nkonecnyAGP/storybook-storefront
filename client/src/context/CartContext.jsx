import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const CartContext = createContext()

function getSessionId() {
  let id = localStorage.getItem('storybook-session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('storybook-session', id)
  }
  return id
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const sessionId = getSessionId()

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch(`/api/cart/${sessionId}`)
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to fetch cart', err)
    }
  }, [sessionId])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const addToCart = async (bookId) => {
    await fetch(`/api/cart/${sessionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    await fetchCart()
  }

  const updateQuantity = async (bookId, quantity) => {
    await fetch(`/api/cart/${sessionId}/items/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
    await fetchCart()
  }

  const removeFromCart = async (bookId) => {
    await fetch(`/api/cart/${sessionId}/items/${bookId}`, {
      method: 'DELETE',
    })
    await fetchCart()
  }

  const clearCart = async () => {
    await fetch(`/api/cart/${sessionId}`, { method: 'DELETE' })
    await fetchCart()
  }

  return (
    <CartContext.Provider value={{ items, total, sessionId, addToCart, updateQuantity, removeFromCart, clearCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
