import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../config';

function AdminBell() {
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const load = () =>
            fetch(`${API}/api/orders/admin/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => d && setUnread(d.unread))
                .catch(() => {});
        load();
        const t = setInterval(load, 15000);
        return () => clearInterval(t);
    }, []);

    return (
        <Link to="/admin/orders" className="bell" title="Orders & notifications">
            🔔
            {unread > 0 && <span className="bell-badge">{unread}</span>}
        </Link>
    );
}

export default AdminBell;