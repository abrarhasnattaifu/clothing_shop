import { useCallback, useEffect, useState } from 'react';
import { API, taka } from '../config';
import './Shop.css';

const PROBLEMS = {
    wrong_size: 'Wrong size / does not fit',
    damaged: 'Damaged or defective',
    wrong_item: 'Received a different item',
    quality: 'Poor quality',
    not_as_described: 'Not as described',
    other: 'Other'
};

function AdminReturns() {
    const token = localStorage.getItem('token');
    const [list, setList] = useState([]);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/returns/admin/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setList(data.requests);
                setError('');
            } else {
                setError(data.error || 'Could not load requests.');
            }
        } catch {
            setError('Cannot reach the server. Is the backend running?');
        }
    }, [token]);

    useEffect(() => {
        load();
        const t = setInterval(load, 20000);
        return () => clearInterval(t);
    }, [load]);

    const act = async (id, action) => {
        let note = '';
        let restock = false;
        if (action !== 'approve') {
            const text = window.prompt(action === 'reject' ? 'Reason for rejecting (customer will see it):' : 'Note (optional):');
            if (text === null) return;
            note = text;
        }
        if (action === 'complete') {
            restock = window.confirm('Add the returned item back to stock?\nOK = yes, Cancel = no');
        }
        try {
            const res = await fetch(`${API}/api/returns/admin/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action, note, restock })
            });
            const data = await res.json();
            if (!res.ok) alert(data.error || 'Failed.');
        } catch {
            alert('Cannot reach the server.');
        }
        load();
    };

    return (
        <div className="sp-page">
            <h1>Return requests</h1>
            {error && <p className="sp-msg err">{error}</p>}
            {!error && list.length === 0 && <p>No requests yet.</p>}

            {list.map((r) => (
                <div className="sp-order" key={r.id}>
                    <div className="sp-order-head">
                        <strong>{r.request_code} · {r.type === 'return' ? 'RETURN' : 'REQUEST'}</strong>
                        <small>{new Date(r.created_at).toLocaleString()}</small>
                    </div>
                    <p>
                        <strong>{r.customer_name}</strong> · {r.phone}
                        <br />
                        <small>Account: {r.account_name} ({r.account_email})</small>
                    </p>
                    <p>
                        Order <strong>{r.order_code}</strong> · {r.product_name} ({r.color} / {r.size}) x {r.quantity}
                        {' '}= {taka(r.unit_price * r.quantity)} · {r.payment_method.toUpperCase()}
                    </p>
                    <p>Problem: <strong>{PROBLEMS[r.problem] || r.problem}</strong></p>
                    <p>Details: {r.details}</p>
                    <p>Reason: {r.reason}</p>
                    <p>
                        Status: <strong>{r.status}</strong>
                        {r.admin_note && <> · <small>Note: {r.admin_note}</small></>}
                    </p>

                    <div className="sp-actions">
                        {r.status === 'pending' && (
                            <>
                                <button className="sp-btn small" onClick={() => act(r.id, 'approve')}>Approve</button>
                                <button className="sp-btn small ghost" onClick={() => act(r.id, 'reject')}>Reject</button>
                            </>
                        )}
                        {r.status === 'approved' && (
                            <button className="sp-btn small" onClick={() => act(r.id, 'complete')}>
                                Mark completed
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AdminReturns;