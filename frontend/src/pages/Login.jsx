import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

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
        <div className="auth-container">
            <h2>Login</h2>
            {message && <p>{message}</p>}
            {!codeSent ? (
                <form onSubmit={sendCode}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Login Code'}
                    </button>
                </form>
            ) : (
                <form onSubmit={verifyCode}>
                    <p>Enter the 6-digit code sent to your email:</p>
                    <input
                        type="text"
                        placeholder="Enter the 6-digit code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Verifying...' : 'Verify Code'}
                    </button>
                    <button
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
            <p>Don't have an account? <Link to="/register">Register here</Link></p>
        </div>
    );
};

export default Login;