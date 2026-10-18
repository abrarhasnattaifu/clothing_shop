import { useEffect, useState } from 'react';
import { API } from '@/config';
import '@/pages/shop.css';

const FIELDS = [
    ['shop_about', 'About the shop', 'Short text shown in the footer', 'textarea'],
    ['phone', 'Phone number', '01XXXXXXXXX'],
    ['whatsapp', 'WhatsApp number', '01XXXXXXXXX'],
    ['telegram', 'Telegram username', 'without @, e.g. mamacloset_bd'],
    ['email', 'Email', 'shop@example.com'],
    ['address', 'Address', 'Shop address'],
    ['hours', 'Opening hours', 'e.g. Sat-Thu, 10am - 9pm'],
    ['facebook', 'Facebook page link', 'https://facebook.com/...'],
    ['instagram', 'Instagram link', 'https://instagram.com/...'],
    ['delivery_note', 'Delivery info', 'e.g. 2-4 days inside Chattogram'],
    ['return_note', 'Return info', 'e.g. Returns accepted within 3 days']
];

function AdminSettings() {
    const token = localStorage.getItem('token');
    const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, ''])));
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`${API}/api/settings`)
            .then((r) => r.json())
            .then((d) => d.settings && setForm((f) => ({ ...f, ...d.settings })))
            .catch(() => {});
    }, []);

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch(`${API}/api/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) {
                setIsError(true);
                setMessage(data.error || 'Something went wrong.');
            } else {
                setIsError(false);
                setMessage('Saved. The footer is updated.');
                setForm((f) => ({ ...f, ...data.settings }));
                window.dispatchEvent(new Event('settings-change'));
            }
        } catch {
            setIsError(true);
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sp-page">
            <h1>Footer settings</h1>
            <p className="sp-muted">Leave a field empty to hide it from the footer.</p>
            {message && <p className={`sp-msg ${isError ? 'err' : 'ok'}`}>{message}</p>}

            <form className="sp-form" onSubmit={save}>
                {FIELDS.map(([key, label, hint, type]) => (
                    <label key={key}>
                        {label}
                        {type === 'textarea' ? (
                            <textarea
                                rows={3}
                                maxLength={300}
                                value={form[key]}
                                placeholder={hint}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                        ) : (
                            <input
                                value={form[key]}
                                placeholder={hint}
                                maxLength={200}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                        )}
                    </label>
                ))}
                <div className="sp-actions">
                    <button type="submit" className="sp-btn" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AdminSettings;