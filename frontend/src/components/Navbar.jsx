import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';


function Navbar({ user, setUser }) {
    const navigate = useNavigate();
    const isLoggedIn = !!user;

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    return (
        <header className="navbar">
            <Link to="/" className="logo">
                CLOTHIFY<span>.</span>
            </Link>

            <nav className="nav-links">
                <Link to="/">Home</Link>
                <a href="/#collections">Collections</a>
                <a href="/#about">About</a>
                {isLoggedIn && <Link to="/dashboard">Dashboard</Link>}
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
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                )}
            </div>
        </header>
    );
}

export default Navbar;