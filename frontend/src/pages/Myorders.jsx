import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, taka } from '../config';
import OrderProgress from '../components/Orderprogress';
import './shop.css';

const METHOD = { cod: 'Cash on delivery', bkash: 'bKash', rocket: 'Rocket' };

const canRequestCancel = (o) => ['pending', 'confirmed'].includes(o.order_status) && !o.cancel_requested;

function MyOrders() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [orders, setOrders] = useState([]);
    const [hold, setHold] = useState(1440);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [askId, setAskId] = useState(null); // kon order er cancel box khola
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null); // { text, error }
    const [refundAskId, setRefundAskId] = useState(null);
    const [refundReason, setRefundReason] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/orders/mine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load your orders.');
            setOrders(data.orders);
            setHold(data.hold_minutes || 1440);
            setError('');
        } catch (err) {
            setError(
                err.message === 'Failed to fetch'
                    ? 'Cannot reach the server. Is the backend running?'
                    : err.message
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const waiting = orders.some((o) => o.order_status === 'pending');
    useEffect(() => {
        if (!waiting) return;
        const t = setInterval(load, 10000);
        return () => clearInterval(t);
    }, [waiting, load]);

    const sendCancel = async (id, reviewPayment = false) => {
        setBusy(true);
        setNotice(null);
        try {
            const res = await fetch(`${API}/api/orders/${id}/${reviewPayment ? 'cancel-request' : 'cancel'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong.');
            setNotice({ text: data.message, error: false });
            setAskId(null);
            setReason('');
            await load();
        } catch (err) {
            setNotice({
                text: err.message === 'Failed to fetch' ? 'Cannot reach the server. Is the backend running?' : err.message,
                error: true
            });
        } finally {
            setBusy(false);
        }
    };

    const requestRefund = async (id) => {
        setBusy(true);
        setNotice(null);
        try {
            const res = await fetch(`${API}/api/orders/${id}/refund-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason: refundReason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not request a refund.');
            setNotice({ text: data.message, error: false });
            setRefundAskId(null);
            setRefundReason('');
            await load();
        } catch (err) {
            setNotice({ text: err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message, error: true });
        } finally {
            setBusy(false);
        }
    };

    const openOrderConversation = async (id) => {
        try {
            const res = await fetch(`${API}/api/conversations/order/${id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not open the conversation.');
            navigate(`/messages?conversation=${data.conversation_id}`);
        } catch (err) {
            setNotice({ text: err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message, error: true });
        }
    };

    if (loading) return <div className="sp-page"><p>Loading...</p></div>;

    return (
        <div className="sp-page">
            <h1>My orders</h1>
            {error && <p className="sp-msg err">{error}</p>}
            {notice && <p className={`sp-msg ${notice.error ? 'err' : 'ok'}`}>{notice.text}</p>}

            {!error && orders.length === 0 && (
                <>
                    <p>You have not placed any order yet.</p>
                    <Link to="/collections">Go to collections</Link>
                </>
            )}

            {orders.map((o) => (
                <div className="sp-order" key={o.order_code}>
                    <div className="sp-order-head">
                        <strong>{o.order_code}</strong>
                        <small>{new Date(o.created_at).toLocaleString()}</small>
                    </div>

                    <ul>
                        {o.items.map((i, idx) => (
                            <li key={idx}>
                                {i.product_name} ({i.color} / {i.size}) x {i.quantity} = {taka(i.unit_price * i.quantity)}
                            </li>
                        ))}
                    </ul>

                    <p>
                        Total: <strong>{taka(o.total)}</strong> · {METHOD[o.payment_method]}
                        {o.trx_id && <> · TrxID: <code>{o.trx_id}</code></>}
                    </p>

                    <OrderProgress order={o} holdMinutes={hold} />

                    {o.cancel_requested && o.order_status !== 'cancelled' && o.cancel_reason && (
                        <p><small>Your reason: {o.cancel_reason}</small></p>
                    )}

                    {canRequestCancel(o) && askId !== o.id && (
                        <button
                            type="button"
                            className="sp-btn small ghost"
                            onClick={() => {
                                const paymentReview = o.payment_status === 'verifying';
                                const warning = paymentReview
                                    ? 'Your payment is still being checked, so the shop must review a cancellation request before it can be cancelled. Continue?'
                                    : `This will cancel order ${o.order_code} now.${o.payment_status === 'paid' && o.payment_method !== 'cod' ? ' A refund request will also be sent to the shop.' : ''} Continue?`;
                                if (!window.confirm(warning)) return;
                                setAskId(o.id);
                                setReason('');
                                setNotice(null);
                            }}
                        >
                            {o.payment_status === 'verifying' ? 'Request cancellation review' : 'Cancel order'}
                        </button>
                    )}
                    {o.order_status === 'delivered' && (
                        <Link to={`/returns?code=${o.order_code}`} className="sp-btn small ghost" style={{ textDecoration: 'none' }}>
                            Return product
                        </Link>
                    )}
                    <button
                        type="button"
                        className="sp-btn small ghost"
                        onClick={() => openOrderConversation(o.id)}
                    >
                        Message the shop
                    </button>
                    {o.order_status === 'cancelled' && ['paid', 'verifying'].includes(o.payment_status) &&
                        o.payment_method !== 'cod' && !o.refunded && !o.refund_requested && refundAskId !== o.id && (
                            <button
                                type="button"
                                className="sp-btn small ghost"
                                onClick={() => { setRefundAskId(o.id); setRefundReason(''); setNotice(null); }}
                            >
                                Request refund
                            </button>
                        )}
                    {o.refund_requested && !o.refunded && (
                        <p className="sp-msg ok">Your refund request is waiting for the shop to review.</p>
                    )}
                    {refundAskId === o.id && (
                        <div className="sp-form" style={{ marginTop: 10 }}>
                            <label>
                                Refund details (optional)
                                <textarea
                                    rows={2}
                                    maxLength={300}
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                />
                            </label>
                            <p className="sp-muted">
                                The shop will review your request. Refunds are sent manually to the payment number used for this order.
                            </p>
                            <div className="sp-actions">
                                <button type="button" className="sp-btn small" disabled={busy} onClick={() => requestRefund(o.id)}>
                                    {busy ? 'Sending...' : 'Send refund request'}
                                </button>
                                <button type="button" className="sp-btn small ghost" disabled={busy} onClick={() => setRefundAskId(null)}>
                                    Never mind
                                </button>
                            </div>
                        </div>
                    )}

                    {askId === o.id && (
                        <div className="sp-form" style={{ marginTop: 10 }}>
                            <label>
                                Why do you want to cancel? (optional)
                                <textarea
                                    rows={2}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    maxLength={300}
                                />
                            </label>
                            <small>
                                {o.payment_status === 'verifying'
                                    ? 'The shop must review your request while payment is being checked.'
                                    : 'This cancels the order now. If you paid online, a refund request is sent to the shop for review.'}
                            </small>
                            <div className="sp-actions">
                                <button
                                    type="button"
                                    className="sp-btn small"
                                    disabled={busy}
                                    onClick={() => sendCancel(o.id, o.payment_status === 'verifying')}
                                >
                                    {busy ? 'Sending...' : o.payment_status === 'verifying'
                                        ? 'Send cancellation request'
                                        : 'Confirm cancellation'}
                                </button>
                                <button type="button" className="sp-btn small ghost" disabled={busy} onClick={() => setAskId(null)}>
                                    Never mind
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default MyOrders;