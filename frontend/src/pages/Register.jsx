import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { API } from '@/config';
import '@/pages/Auth.css';

const Register = ({ setUser }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const register = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
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
        } catch {
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page auth-page--register">
            <section className="auth-container" aria-labelledby="auth-title">
                <div className="auth-card-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                        <path d="M19 5v6M16 8h6" />
                    </svg>
                </div>
                <p className="auth-eyebrow">JOIN MAMACLOSET</p>
                <h1 className="auth-title" id="auth-title">Create your account</h1>
                <p className="auth-description">
                    A few details and you will be ready to find your next favorite look.
                </p>
                {message && <p className="auth-message" role="status">{message}</p>}
                <form className="auth-form" onSubmit={register}>
                    <input
                        type="text"
                        placeholder="Name"
                        aria-label="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        aria-label="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password (min 8 characters)"
                        aria-label="Password, at least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        required
                    />
                    <button className="auth-primary-button" type="submit" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
            </section>
        </main>
    );
};

export default Register;