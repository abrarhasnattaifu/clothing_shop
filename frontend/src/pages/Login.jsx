import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Auth.css';

const API = 'http://localhost:5000/api/auth';

const Login = ({ setUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');

    const [codeSent, setCodeSent] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const sendCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                setCodeSent(true);
                setMessage(data.message);
            } else {
                setMessage(data.error || 'Something went wrong.');
            }
        } catch (error) {
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, purpose: 'login' })
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
                <h1 className="auth-title" id="auth-title">{codeSent ? 'Verify your email' : 'Welcome back'}</h1>
                <p className="auth-description">
                    {codeSent ? 'Enter the 6-digit code we sent to finish signing in.' : 'Sign in to continue shopping and manage your orders.'}
                </p>
                {message && <p className="auth-message" role="status">{message}</p>}
                {!codeSent ? (
                    <form className="auth-form" onSubmit={sendCode}>
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
                        {loading ? 'Sending...' : 'Send Login Code'}
                    </button>
                </form>
            ) : (
                <form className="auth-form" onSubmit={verifyCode}>
                    <input
                        type="text"
                        placeholder="Enter the 6-digit code"
                        aria-label="6-digit verification code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        required
                    />
                    <button className="auth-primary-button" type="submit" disabled={loading}>
                        {loading ? 'Verifying...' : 'Verify Code'}
                    </button>
                    <button
                        className="auth-secondary-button"
                        type="button"
                        disabled={loading}
                        onClick={() => {
                            setCodeSent(false);
                            setCode('');
                            setMessage('');
                        }}
                    >
                        Back
                    </button>
                </form>
            )}
                <p className="auth-switch">New to MamaCloset? <Link to="/register">Create an account</Link></p>
            </section>
        </main>
    );
};

export default Login;