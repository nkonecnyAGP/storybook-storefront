import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import BookDetail from './pages/BookDetail'
import CreateBook from './pages/CreateBook'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'

function App() {
  return (
    <div className="min-h-screen bg-[#fffbf0] dark:bg-gray-900 transition-colors">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/create" element={<CreateBook />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderConfirmation />} />
        </Routes>
      </main>
      <footer className="text-center py-8 text-gray-400 dark:text-gray-600 text-sm font-body">
        Made with AI + Imagination
      </footer>
    </div>
  )
}

export default App
