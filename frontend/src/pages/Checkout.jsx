import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, imgUrl, taka } from '@/config';
import useCart from '@/useCart';
import OrderProgress from '@/components/Orderprogress';
import '@/pages/shop.css';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Checkout({ user }) {
    const token = localStorage.getItem('token');
    const { items, loading } = useCart();
    const [info, setInfo] = useState({ bkash: '', rocket: '', delivery_fee: 0 });
    const [form, setForm] = useState({
        name: user?.name || '',
        phone: '',
        address: '',
        note: '',
        payment_method: 'cod',
        pay_number: '',
        trx_id: ''
    });
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(null);

    useEffect(() => {
        fetch(`${API}/api/orders/payment-info`)
            .then((r) => r.json())
            .then(setInfo)
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!done || done.order_status !== 'pending') return;
        const t = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/orders/code/${done.order_code}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    setDone((prev) => ({
                        ...prev,
                        payment_status: data.order.payment_status,
                        order_status: data.order.order_status
                    }));
                }
            } catch {
            }
        }, 10000);
        return () => clearInterval(t);
    }, [done, token]);

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + Number(info.delivery_fee || 0);
    const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const isMobilePay = form.payment_method !== 'cod';
    const shopNumber = form.payment_method === 'bkash' ? info.bkash : info.rocket;
    const soonest = items.length ? Math.min(...items.map((i) => i.left)) : 0;

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage('');
        try {
            const res = await fetch(`${API}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data.error || 'Something went wrong.');
            } else {
                setDone({ ...data, payment_method: form.payment_method });
                window.dispatchEvent(new Event('cart-change'));
            }
        } catch {
            setMessage('Cannot reach the server. Is the backend running?');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="sp-page">
                <h1>Thank you! Your order is placed</h1>
                <p>Your order code:</p>
                <p className="sp-code">{done.order_code}</p>
                <p className="sp-muted">Save this code. You will need it if you contact us about this order.</p>
                <p>Total: <strong>{taka(done.total)}</strong></p>

                <OrderProgress order={done} holdMinutes={info.hold_minutes || 1440} />

                <div className="sp-actions" style={{ marginTop: 18 }}>
                    <Link to="/orders" className="sp-btn" style={{ textDecoration: 'none' }}>See my orders</Link>
                    <Link to="/collections" className="sp-btn ghost" style={{ textDecoration: 'none' }}>Continue shopping</Link>
                </div>
            </div>
        );
    }

    if (loading) return <div className="sp-page"><p>Loading...</p></div>;

    if (items.length === 0) {
        return (
            <div className="sp-page">
                <h1>Your cart is empty</h1>
                <p className="sp-muted">Items are reserved for 30 minutes. If time ran out, please add them again.</p>
                <Link to="/collections">Go to collections</Link>
            </div>
        );
    }

    return (
        <div className="sp-page">
            <h1>Checkout</h1>
            <p className="sp-msg err">Your items are reserved for <strong>{mmss(soonest)}</strong>. Please complete the order before the time ends.</p>

            <div className="sp-table-wrap">
                <table className="sp-table">
                    <tbody>
                        {items.map((i) => (
                            <tr key={i.id}>
                                <td><img src={imgUrl(i.image)} alt="" className="sp-thumb" /></td>
                                <td>{i.name} <small>({i.color} / {i.size})</small></td>
                                <td>{taka(i.price)} x {i.quantity}</td>
                                <td>{taka(i.price * i.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p><Link to="/cart">&larr; Edit cart</Link></p>

            <p>Subtotal: {taka(subtotal)}</p>
            <p>Delivery: {taka(info.delivery_fee)}</p>
            <p className="sp-price big">Total: {taka(total)}</p>

            {message && <p className="sp-msg err">{message}</p>}

            <form className="sp-form" onSubmit={submit}>
                <h2>Delivery details</h2>
                <label>
                    Name
                    <input value={form.name} onChange={setField('name')} maxLength={100} required />
                </label>
                <label>
                    Mobile number
                    <input value={form.phone} onChange={setField('phone')} placeholder="01XXXXXXXXX" required />
                </label>
                <label>
                    Full address
                    <textarea rows={3} value={form.address} onChange={setField('address')} maxLength={500} required />
                </label>
                <label>
                    Note (optional)
                    <input value={form.note} onChange={setField('note')} maxLength={300} />
                </label>

                <h2>Payment method</h2>
                <div className="sp-sizes">
                    {[['cod', 'Cash on delivery'], ['bkash', 'bKash'], ['rocket', 'Rocket']].map(([v, label]) => (
                        <button
                            type="button"
                            key={v}
                            className={form.payment_method === v ? 'on' : ''}
                            onClick={() => setForm({ ...form, payment_method: v, trx_id: '', pay_number: '' })}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {isMobilePay && (
                    <div className="sp-msg ok" style={{ color: 'inherit' }}>
                        <p>
                            1. Send Money <strong>{taka(total)}</strong> (exact amount) to{' '}
                            <strong>{shopNumber || '(number not set yet)'}</strong>
                        </p>
                        <p>2. Enter the number you sent the money from, and the TrxID from your confirmation SMS.</p>
                        <p>
                            <small>
                                The shop checks your payment and confirms your order. You can follow it in My Orders.
                            </small>
                        </p>
                    </div>
                )}
                {isMobilePay && (
                    <label>
                        Your {form.payment_method === 'bkash' ? 'bKash' : 'Rocket'} number (the one you paid from)
                        <input
                            value={form.pay_number}
                            onChange={setField('pay_number')}
                            placeholder="01XXXXXXXXX"
                            inputMode="numeric"
                            required
                        />
                    </label>
                )}
                {isMobilePay && (
                    <label>
                        TrxID
                        <input
                            value={form.trx_id}
                            onChange={(e) => setForm({ ...form, trx_id: e.target.value.toUpperCase() })}
                            maxLength={20}
                            required
                        />
                    </label>
                )}

                <div className="sp-actions">
                    <button type="submit" className="sp-btn" disabled={submitting}>
                        {submitting ? 'Placing order...' : 'Place order'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default Checkout;