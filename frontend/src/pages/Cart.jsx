import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { imgUrl, taka } from '@/config';
import { setQty, removeItem, startCheckout } from '@/cart';
import useCart from '@/useCart';
import '@/pages/shop.css';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Cart() {
    const { items, loading, error } = useCart();
    const navigate = useNavigate();
    const [msg, setMsg] = useState('');

    const act = async (fn) => {
        setMsg('');
        try {
            await fn();
        } catch (e) {
            setMsg(e.message);
        }
    };

    const proceed = () =>
        act(async () => {
            await startCheckout();
            navigate('/checkout');
        });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

    if (loading) return <div className="sp-page"><p>Loading...</p></div>;

    if (items.length === 0) {
        return (
            <div className="sp-page">
                <h1>Your cart is empty</h1>
                <p className="sp-muted">Items are reserved for 30 minutes. If time ran out, add them again.</p>
                <Link to="/collections">Go to collections</Link>
            </div>
        );
    }

    return (
        <div className="sp-page">
            <h1>Your cart</h1>
            <p className="sp-muted">Each item is reserved for you for 30 minutes. After that it is released.</p>

            {(msg || error) && <p className="sp-msg err">{msg || error}</p>}

            <div className="sp-table-wrap">
                <table className="sp-table">
                    <tbody>
                        {items.map((i) => (
                            <tr key={i.id}>
                                <td><img src={imgUrl(i.image)} alt="" className="sp-thumb" /></td>
                                <td>{i.name} <small>({i.color} / {i.size})</small></td>
                                <td>{taka(i.price)}</td>
                                <td>
                                    <button type="button" className="sp-btn small ghost" disabled={i.quantity <= 1}
                                        onClick={() => act(() => setQty(i.id, i.quantity - 1))}>-</button>
                                    <span style={{ margin: '0 10px' }}>{i.quantity}</span>
                                    <button type="button" className="sp-btn small ghost" disabled={i.quantity >= i.max}
                                        onClick={() => act(() => setQty(i.id, i.quantity + 1))}>+</button>
                                </td>
                                <td>{taka(i.price * i.quantity)}</td>
                                <td className="sp-timer">{mmss(i.left)}</td>
                                <td>
                                    <button type="button" className="sp-btn small ghost"
                                        onClick={() => act(() => removeItem(i.id))}>Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="sp-price big">Subtotal: {taka(subtotal)}</p>

            <div className="sp-actions">
                <Link to="/collections" className="sp-btn ghost" style={{ textDecoration: 'none' }}>Keep shopping</Link>
                <button type="button" className="sp-btn" onClick={proceed}>Proceed to checkout</button>
            </div>
        </div>
    );
}

export default Cart;