import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, taka } from '../config';
import './shop.css';

const STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled'];

function AdminOrders() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [orders, setOrders] = useState([]);
    const [notes, setNotes] = useState([]);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const [o, n] = await Promise.all([
                fetch(`${API}/api/orders/admin/all`, { headers }),
                fetch(`${API}/api/orders/admin/notifications`, { headers })
            ]);
            const od = await o.json();
            const nd = await n.json();
            if (o.ok) {
                setOrders(od.orders);
                setError('');
            } else {
                setError(od.error || 'Could not load orders.');
            }
            if (n.ok) setNotes(nd.notifications);
            // dekha hoye gele bell er number 0 hobe
            fetch(`${API}/api/orders/admin/notifications/read`, { method: 'POST', headers }).catch(() => {});
        } catch {
            setError('Cannot reach the server. Is the backend running?');
        }
    }, [token]);

    useEffect(() => {
        load();
        const t = setInterval(load, 15000);
        return () => clearInterval(t);
    }, [load]);

    const act = async (path, body) => {
        try {
            const res = await fetch(`${API}/api/orders/admin/${path}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
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
            <h1>Orders</h1>
            {error && <p className="sp-msg err">{error}</p>}

            {notes.length > 0 && (
                <div className="sp-notes">
                    <h2>Notifications</h2>
                    {notes.slice(0, 8).map((n) => (
                        <p key={n.id} className={n.is_read ? '' : 'new'}>
                            {n.message} <small>{new Date(n.created_at).toLocaleString()}</small>
                        </p>
                    ))}
                </div>
            )}

            {orders.length === 0 && !error && <p>No orders yet.</p>}

            {orders.map((o) => (
                <div className="sp-order" key={o.id}>
                    <div className="sp-order-head">
                        <strong>{o.order_code}</strong>
                        <small>{new Date(o.created_at).toLocaleString()}</small>
                    </div>

                    <p>
                        <strong>{o.customer_name}</strong> · {o.phone}
                        <br />
                        <small>Account: {o.account_name} ({o.account_email})</small>
                    </p>
                    <p>{o.address}</p>
                    {o.note && <p><small>Note: {o.note}</small></p>}

                    <ul>
                        {o.items.map((i, idx) => (
                            <li key={idx}>
                                {i.product_name} ({i.color} / {i.size}) x {i.quantity} = {taka(i.unit_price * i.quantity)}
                            </li>
                        ))}
                    </ul>

                    <p>
                        Total: <strong>{taka(o.total)}</strong> · {o.payment_method.toUpperCase()}
                        {o.trx_id && <> · TrxID: <code>{o.trx_id}</code></>}
                        {o.pay_number && <> · Paid from: <code>{o.pay_number}</code></>}
                    </p>
                    <p>
                        Payment: <strong>{o.payment_status}</strong> · Order: <strong>{o.order_status}</strong>
                    </p>

                    {o.payment_status === 'verifying' && (
                        <p className="sp-msg ok" style={{ color: 'inherit' }}>
                            <small>
                                Check your {o.payment_method === 'bkash' ? 'bKash' : 'Rocket'} app for TrxID{' '}
                                <code>{o.trx_id}</code>, amount <strong>{taka(o.total)}</strong>, from{' '}
                                <code>{o.pay_number || 'n/a'}</code>. If it matches, press Approve payment.
                            </small>
                        </p>
                    )}

                    {!!o.cancel_requested && o.order_status !== 'cancelled' && (
                        <div className="sp-msg err">
                            <p>
                                <strong>Customer asked to cancel this order.</strong>
                                {o.cancel_reason ? ` Reason: ${o.cancel_reason}` : ''}
                            </p>
                            <div className="sp-actions" style={{ marginTop: 8 }}>
                                <button
                                    className="sp-btn small"
                                    onClick={() => {
                                        if (window.confirm('Cancel this order and return the stock?')) {
                                            act(`${o.id}/status`, { order_status: 'cancelled' });
                                        }
                                    }}
                                >
                                    Cancel order
                                </button>
                                <button
                                    className="sp-btn small ghost"
                                    onClick={() => act(`${o.id}/cancel-request`, { action: 'dismiss' })}
                                >
                                    Keep order
                                </button>
                            </div>
                        </div>
                    )}

                    {o.order_status === 'cancelled' && ['paid', 'verifying'].includes(o.payment_status) && o.payment_method !== 'cod' && (
                        o.refunded ? (
                            <p className="sp-msg ok"><small>Refunded ✓</small></p>
                        ) : (
                            <div className="sp-msg err">
                                <p>
                                    <strong>Refund due:</strong> {taka(o.total)} to{' '}
                                    <code>{o.pay_number || 'the customer'}</code> ({o.payment_method})
                                </p>
                                {o.payment_status === 'verifying' && (
                                    <p>Payment is not verified yet. Check the TrxID before sending any refund.</p>
                                )}
                                {o.refund_requested ? (
                                    <>
                                        {o.refund_reason && <p>Buyer note: {o.refund_reason}</p>}
                                        <button
                                            className="sp-btn small"
                                            style={{ marginTop: 8 }}
                                            onClick={() => {
                                                if (window.confirm('Verify the payment if needed, then confirm that the refund has actually been sent to the buyer?')) {
                                                    act(`${o.id}/refund`, {});
                                                }
                                            }}
                                        >
                                            Mark as refunded
                                        </button>
                                    </>
                                ) : <p>The buyer has not requested a refund yet.</p>}
                            </div>
                        )
                    )}

                    <div className="sp-actions">
                        <button
                            className="sp-btn small ghost"
                            onClick={async () => {
                                try {
                                    const response = await fetch(`${API}/api/conversations/admin/order/${o.id}`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                    });
                                    const data = await response.json();
                                    if (!response.ok) throw new Error(data.error || 'Could not open the conversation.');
                                    navigate(`/admin/messages?conversation=${data.conversation_id}`);
                                } catch (error) {
                                    alert(error.message === 'Failed to fetch' ? 'Cannot reach the server.' : error.message);
                                }
                            }}
                        >
                            Message buyer
                        </button>
                        {o.order_status === 'cancelled' && !o.refunded && o.payment_status !== 'rejected' && (
                            <button
                                className="sp-btn small ghost"
                                onClick={() => {
                                    if (window.confirm('Restore this cancelled order? Stock will be reserved again, and the buyer will be notified.')) {
                                        act(`${o.id}/reinstate`, {});
                                    }
                                }}
                            >
                                Restore order
                            </button>
                        )}
                        {o.order_status === 'delivered' && !o.delivered_at && (
                            <button
                                className="sp-btn small"
                                onClick={() => act(`${o.id}/status`, { order_status: 'delivered' })}
                            >
                                Record delivery date
                            </button>
                        )}
                        {o.order_status !== 'cancelled' && o.payment_status === 'verifying' && (
                            <>
                                <button className="sp-btn small" onClick={() => act(`${o.id}/payment`, { action: 'approve' })}>
                                    Approve payment
                                </button>
                                <button className="sp-btn small ghost" onClick={() => act(`${o.id}/payment`, { action: 'reject' })}>
                                    Reject
                                </button>
                            </>
                        )}
                        {o.order_status !== 'cancelled' && o.order_status !== 'pending' && (
                            <select
                                value={o.order_status}
                                onChange={(e) => act(`${o.id}/status`, { order_status: e.target.value })}
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AdminOrders;