import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API, taka } from '../config';
import './Shop.css';

export const PROBLEMS = {
    wrong_size: 'Wrong size / does not fit',
    damaged: 'Damaged or defective',
    wrong_item: 'Received a different item',
    quality: 'Poor quality',
    not_as_described: 'Not as described / different from photo',
    other: 'Other'
};
const STATUS_TEXT = {
    pending: 'Waiting for our review',
    approved: 'Approved. We will contact you.',
    rejected: 'Rejected',
    completed: 'Completed'
};

function ReturnRequest() {
    const token = localStorage.getItem('token');
    const [params] = useSearchParams();
    const [code, setCode] = useState((params.get('code') || '').toUpperCase());
    const [order, setOrder] = useState(null);
    const [mine, setMine] = useState([]);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(null);
    const [form, setForm] = useState({
        item_id: '',
        quantity: 1,
        problem: 'wrong_size',
        details: '',
        reason: ''
    });

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const loadMine = useCallback(() => {
        fetch(`${API}/api/returns/mine`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((d) => d.requests && setMine(d.requests))
            .catch(() => {});
    }, [token]);

    useEffect(() => {
        loadMine();
    }, [loadMine]);

    const lookup = useCallback(async (c) => {
        setLoading(true);
        setMessage('');
        setOrder(null);
        try {
            const res = await fetch(`${API}/api/returns/order/${encodeURIComponent(c.trim())}`, { headers });
            const data = await res.json();
            if (!res.ok) {
                setIsError(true);
                setMessage(data.error || 'Something went wrong.');
            } else if (data.items.length === 0) {
                setIsError(true);
                setMessage('Requests were already sent for every product in this order.');
            } else {
                setOrder(data);
                setForm((f) => ({ ...f, item_id: data.items[0].id, quantity: 1 }));
            }
        } catch {
            setIsError(true);
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (params.get('code')) lookup(params.get('code'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const chosen = order?.items.find((i) => i.id === Number(form.item_id));

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch(`${API}/api/returns`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...form, type: 'return', order_code: order.order_code })
            });
            const data = await res.json();
            if (!res.ok) {
                setIsError(true);
                setMessage(data.error || 'Something went wrong.');
            } else {
                setDone(data);
                setOrder(null);
                loadMine();
            }
        } catch {
            setIsError(true);
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="sp-page">
                <h1>Request sent</h1>
                <p>Your request code:</p>
                <p className="sp-code">{done.request_code}</p>
                <p className="sp-muted">{done.message}</p>
                <p style={{ marginTop: 16 }}>
                    <button type="button" className="sp-btn small" onClick={() => { setDone(null); setCode(''); }}>
                        Send another request
                    </button>{' '}
                    <Link to="/orders">My orders</Link>
                </p>
            </div>
        );
    }

    return (
        <div className="sp-page">
            <h1>Return product</h1>
            <p className="sp-muted">
                You can send a request after your order is delivered, within a few days of delivery.
                Please give the correct details so we can help you faster.
            </p>

            {message && <p className={`sp-msg ${isError ? 'err' : 'ok'}`}>{message}</p>}

            <form
                className="sp-form"
                onSubmit={(e) => { e.preventDefault(); lookup(code); }}
            >
                <label>
                    Order code
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="CL-XXXXXX"
                        required
                    />
                </label>
                <div className="sp-actions">
                    <button type="submit" className="sp-btn" disabled={loading}>Find my order</button>
                </div>
            </form>

            {order && (
                <form className="sp-form" onSubmit={submit} style={{ marginTop: 28 }}>
                    <h2>Order {order.order_code}</h2>
                    <p className="sp-muted">You have about {order.days_left} day(s) left to send a request for this order.</p>

                    <label>
                        Product
                        <select
                            value={form.item_id}
                            onChange={(e) => setForm({ ...form, item_id: Number(e.target.value), quantity: 1 })}
                        >
                            {order.items.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.product_name} ({i.color} / {i.size}) · {taka(i.unit_price)} · up to {i.remaining}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="sp-row">
                        <label>
                            Quantity
                            <input
                                type="number"
                                min="1"
                                max={chosen ? chosen.remaining : 1}
                                value={form.quantity}
                                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                                required
                            />
                        </label>
                    </div>

                    <label>
                        What is the problem?
                        <select value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })}>
                            {Object.entries(PROBLEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </label>

                    <label>
                        Describe the problem *
                        <textarea
                            rows={4}
                            minLength={10}
                            maxLength={500}
                            value={form.details}
                            onChange={(e) => setForm({ ...form, details: e.target.value })}
                            placeholder="Tell us what is wrong with the product"
                            required
                        />
                    </label>

                    <label>
                        Why do you want to return this product? *
                        <textarea
                            rows={3}
                            minLength={5}
                            maxLength={300}
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            placeholder="Your reason"
                            required
                        />
                    </label>

                    <div className="sp-actions">
                        <button type="submit" className="sp-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send request'}
                        </button>
                    </div>
                </form>
            )}

            {mine.length > 0 && (
                <>
                    <h2 className="sp-h2">My requests</h2>
                    {mine.map((r) => (
                        <div className="sp-order" key={r.request_code}>
                            <div className="sp-order-head">
                                <strong>{r.request_code}</strong>
                                <small>{new Date(r.created_at).toLocaleString()}</small>
                            </div>
                            <p>
                                {r.type === 'return' ? 'Return' : 'Request'}: {r.product_name} ({r.color} / {r.size}) x {r.quantity}
                                {' '}· Order {r.order_code}
                            </p>
                            <p>Status: <strong>{STATUS_TEXT[r.status]}</strong></p>
                            {r.admin_note && <p><small>Note from us: {r.admin_note}</small></p>}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default ReturnRequest;