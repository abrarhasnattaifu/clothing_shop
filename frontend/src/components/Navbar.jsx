import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminBell from '@/components/AdminBell';
import BuyerBell from '@/components/BuyerBell';
import '@/components/Navbar.css';
import { fetchCart } from '@/cart';
import { API } from '@/config';

function Navbar({ user, setUser }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [count, setCount] = useState(0);
    const [activityOpen, setActivityOpen] = useState(false);
    const activityRef = useRef(null);

    const isLoggedIn = !!user;
    const isAdmin = isLoggedIn && user.role === 'admin';

    useEffect(() => {
        if (!isLoggedIn) {
            setCount(0);
            return;
        }
        const update = () =>
            fetchCart()
                .then((d) => setCount(d.items.reduce((n, i) => n + i.quantity, 0)))
                .catch(() => {});
        update();
        window.addEventListener('cart-change', update);
        const t = setInterval(update, 60000);
        return () => {
            window.removeEventListener('cart-change', update);
            clearInterval(t);
        };
    }, [isLoggedIn]);

    useEffect(() => {
        setActivityOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (!activityRef.current?.contains(event.target)) setActivityOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setActivityOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <Link to="/" className="logo">
                    MamaCloset<span>.</span>
                </Link>
                {isLoggedIn && (
                    <span className={`navbar-role${isAdmin ? ' admin' : ' buyer'}`}>
                        {isAdmin ? 'Admin' : 'Buyer'}
                    </span>
                )}
            </div>

            <nav className="nav-links">
                <Link to="/">Home</Link>
                <Link to="/collections">Collections</Link>
                <Link to="/about">About</Link>
                {isLoggedIn && !isAdmin && <BuyerBell />}
                {isLoggedIn && !isAdmin && (
                    <div className="nav-dropdown" ref={activityRef}>
                        <button
                            type="button"
                            className="nav-dropdown-trigger"
                            aria-expanded={activityOpen}
                            aria-controls="user-activity-menu"
                            onClick={() => setActivityOpen((open) => !open)}
                        >
                            User Activity <span aria-hidden="true">{activityOpen ? '▴' : '▾'}</span>
                        </button>
                        {activityOpen && (
                            <div className="nav-dropdown-menu" id="user-activity-menu">
                                <Link to="/cart" onClick={() => setActivityOpen(false)}>Cart ({count})</Link>
                                <Link to="/orders" onClick={() => setActivityOpen(false)}>My Orders</Link>
                                <Link to="/messages" onClick={() => setActivityOpen(false)}>My messages</Link>
                                <Link to="/returns" onClick={() => setActivityOpen(false)}>Return product</Link>
                            </div>
                        )}
                    </div>
                )}
                {isAdmin && <Link to="/admin/returns">Returns</Link>}
                {isAdmin && <Link to="/admin/messages">Messages</Link>}
                {isAdmin && <Link to="/admin/settings">Settings</Link>}
                {isLoggedIn && <Link to="/dashboard">Dashboard</Link>}
                {isAdmin && <Link to="/admin/products">Manage Products</Link>}
                {isAdmin && <AdminBell />}
            </nav>

            <div className="auth-buttons">
                {!isLoggedIn ? (
                    <>
                        <Link to="/login" className="login-btn">
                            Login
                        </Link>
                        <Link to="/register" className="register-btn">
                            Registration
                        </Link>
                    </>
                ) : (
                    <>
                        <Link
                            to="/profile"
                            className="profile-btn"
                            aria-label="Profile"
                            title="Profile"
                        >
                            {user.profile_image ? (
                                <img src={`${API}${user.profile_image}`} alt="" />
                            ) : (
                                <span aria-hidden="true">{user.name?.trim().charAt(0).toUpperCase() || '👤'}</span>
                            )}
                        </Link>
                        <button className="logout-btn" onClick={handleLogout}>Logout</button>
                    </>
                )}
            </div>
        </header>
    );
}

export default Navbar;