import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Checkout from '@/pages/Checkout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/dashboard';
import Collections from '@/pages/collections';
import ProductDetail from '@/pages/productDetail';
import AdminProducts from '@/pages/adminProducts';
import Navbar from '@/components/Navbar';
import { API } from '@/config';
import Cart from '@/pages/Cart';
import MyOrders from '@/pages/Myorders';
import AdminOrders from '@/pages/AdminOrders';
import Footer from '@/components/Footer';
import AdminSettings from '@/pages/AdminSettings';
import '@/App.css';
import About from '@/pages/About';
import ReturnRequest from '@/pages/ReturnRequest';
import AdminReturns from '@/pages/AdminReturns';
import Conversations from '@/pages/Conversations';
import Profile from '@/pages/Profile';
import '@/responsive.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        } else if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = user && user.role === 'admin';

  return (
    <Router>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Login setUser={setUser} />} />
        <Route path="/profile" element={user ? <Profile onProfileUpdated={setUser} /> : <Navigate to="/login" replace />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={user ? <Cart /> : <Navigate to="/login" replace />} />
        <Route path="/orders" element={user ? <MyOrders /> : <Navigate to="/login" replace />} />
        <Route
          path="/messages"
          element={user ? (
            user.role === 'admin' ? <Navigate to="/admin/messages" replace /> : <Conversations />
          ) : <Navigate to="/login" replace />}
        />
        <Route path="/checkout" element={user ? <Checkout user={user} /> : <Navigate to="/login" replace />} />
        <Route path="/about" element={<About />} />
        <Route path="/returns" element={user ? <ReturnRequest /> : <Navigate to="/login" replace />} />
        <Route
            path="/admin/orders"
            element={isAdmin ? <AdminOrders /> : <div className="sp-page"><p>This page is for admins only.</p></div>}
        />
        <Route
            path="/admin/messages"
            element={isAdmin ? <Conversations admin /> : <div className="sp-page"><p>This page is for admins only.</p></div>}
        />
        <Route
            path="/admin/settings"
            element={isAdmin ? <AdminSettings /> : <div className="sp-page"><p>This page is for admins only.</p></div>}
        />
        <Route
          path="/admin/products"
          element={
            isAdmin ? (
              <AdminProducts />
            ) : (
              <div className="sp-page"><p>This page is for admins only.</p></div>
            )
          }
        />
        <Route
            path="/admin/returns"
            element={isAdmin ? <AdminReturns /> : <div className="sp-page"><p>This page is for admins only.</p></div>}
        />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;