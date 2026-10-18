import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/config';

function BuyerBell() {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/orders/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load notifications.');
            setNotifications(data.notifications);
            setUnread(data.unread);
            setError('');
        } catch (err) {
            setError(err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message);
        }
    }, [token]);

    useEffect(() => {
        load();
        const timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, [load]);

    const toggle = async () => {
        const opening = !open;
        setOpen(opening);
        if (!opening) return;
        await load();
        try {
            const res = await fetch(`${API}/api/orders/notifications/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not mark notifications as read.');
            setUnread(0);
            setNotifications((items) => items.map((item) => ({ ...item, is_read: 1 })));
        } catch (err) {
            setError(err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message);
        }
    };

    return (
        <div className="buyer-bell">
            <button
                type="button"
                className="buyer-bell-trigger"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                aria-expanded={open}
                aria-controls="buyer-notifications-menu"
                onClick={toggle}
            >
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
                {unread > 0 && <span className="buyer-bell-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {open && (
                <div className="buyer-bell-menu" id="buyer-notifications-menu">
                    <div className="buyer-bell-heading">
                        <strong>Notifications</strong>
                        {unread > 0 && <span>{unread} new</span>}
                    </div>
                    {error && <p className="buyer-bell-message error">{error}</p>}
                    {!error && notifications.length === 0 && (
                        <p className="buyer-bell-message">You have no notifications yet.</p>
                    )}
                    {notifications.map((item) => (
                        <Link
                            className={`buyer-notice${item.is_read ? '' : ' unread'}`}
                            key={item.id}
                            to={item.conversation_id
                                ? `/messages?conversation=${item.conversation_id}`
                                : item.return_request_id
                                    ? '/returns'
                                    : '/orders'}
                            onClick={() => setOpen(false)}
                        >
                            <span>{item.message}</span>
                            <small>{new Date(item.created_at).toLocaleString()}</small>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default BuyerBell;
