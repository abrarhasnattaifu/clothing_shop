import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { API } from '@/config';
import '@/pages/Auth.css';

const Login = ({ setUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const login = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                setUser(data.user);
                navigate('/dashboard', { replace: true });
            } else {
                setMessage(data.error || 'Something went wrong.');
            }
        } catch (error) {
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page auth-page--login">
            <section className="auth-container" aria-labelledby="auth-title">
                <div className="auth-card-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                    </svg>
                </div>
                <p className="auth-eyebrow">MAMACLOSET ACCOUNT</p>
                <h1 className="auth-title" id="auth-title">Welcome back</h1>
                <p className="auth-description">
                    Sign in to continue shopping and manage your orders.
                </p>
                {message && <p className="auth-message" role="status">{message}</p>}
                <form className="auth-form" onSubmit={login}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        aria-label="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Enter your password"
                        aria-label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button className="auth-primary-button" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
                <p className="auth-switch">New to MamaCloset? <Link to="/register">Create an account</Link></p>
            </section>
        </main>
    );
};

export default Login;