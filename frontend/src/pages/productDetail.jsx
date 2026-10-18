import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API, imgUrl, taka } from '../config';
import { addToCart, startCheckout } from '../cart';
import './shop.css';

const readUserRole = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null')?.role || '';
    } catch {
        return '';
    }
};

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [error, setError] = useState('');
    const [active, setActive] = useState(0);
    const [color, setColor] = useState('');
    const [size, setSize] = useState('');
    const [addMsg, setAddMsg] = useState('');
    const [questionBusy, setQuestionBusy] = useState(false);

    useEffect(() => {
        setProduct(null);
        setError('');
        setActive(0);
        setColor('');
        setSize('');
        setAddMsg('');
        fetch(`${API}/api/products/${id}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not load product.');
                setProduct(data.product);
            })
            .catch((err) =>
                setError(
                    err.message === 'Failed to fetch'
                        ? 'Cannot reach the server. Is the backend running?'
                        : err.message
                )
            );
    }, [id]);

    if (error) {
        return (
            <div className="sp-page">
                <p className="sp-msg err">{error}</p>
                <Link to="/collections">Back to collections</Link>
            </div>
        );
    }
    if (!product) {
        return <div className="sp-page"><p>Loading...</p></div>;
    }

    const images = [
        ['Front', product.image_front],
        ['Back', product.image_back],
        ['Side', product.image_side]
    ].filter(([, src]) => src);

    const availableSizes = product.variants.filter((variant) => variant.color === color);
    const chosen = availableSizes.find((variant) => variant.size === size);

    const handleAdd = async (goCheckout) => {
        if (!localStorage.getItem('token')) {
            navigate('/login');
            return;
        }
        if (!color || !chosen) {
            setAddMsg('Please choose a color and size first.');
            return;
        }
        try {
            await addToCart(product.id, color, chosen.size, 1);
            if (goCheckout) {
                await startCheckout();
                navigate('/checkout');
            } else {
                setAddMsg('Added to cart. Reserved for you for 30 minutes.');
            }
        } catch (e) {
            setAddMsg(e.message);
        }
    };

    const askProductQuestion = async () => {
        if (!localStorage.getItem('token')) {
            navigate('/login');
            return;
        }
        if (readUserRole() === 'admin') {
            setAddMsg('Product questions are available from a buyer account.');
            return;
        }
        setQuestionBusy(true);
        setAddMsg('');
        try {
            const response = await fetch(`${API}/api/conversations/product/${product.id}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not open the conversation.');
            navigate(`/messages?conversation=${data.conversation_id}`);
        } catch (err) {
            setAddMsg(err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message);
        } finally {
            setQuestionBusy(false);
        }
    };

    return (
        <div className="sp-page">
            <Link to="/collections">&larr; Back to collections</Link>

            <div className="sp-detail">
                <div>
                    <img className="sp-main-img" src={imgUrl(images[active][1])} alt={product.name} />
                    <div className="sp-thumbs">
                        {images.map(([label, src], i) => (
                            <button
                                type="button"
                                key={label}
                                className={i === active ? 'on' : ''}
                                onClick={() => setActive(i)}
                                aria-label={`${label} view`}
                            >
                                <img src={imgUrl(src)} alt={label} />
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h1>{product.name}</h1>
                    <p className="sp-price big">
                        {taka(product.final_price)}
                        {product.discount_percent > 0 && (
                            <>
                                <span className="sp-old">{taka(product.price)}</span>
                                <span className="sp-off">{product.discount_percent}% off</span>
                            </>
                        )}
                    </p>

                    {product.description && <p className="sp-desc">{product.description}</p>}

                    <p className="sp-label">Color</p>
                    <div className="sp-colors">
                        {product.colors.map((item) => (
                            <button
                                type="button"
                                key={item.color}
                                disabled={item.total_stock <= 0}
                                className={item.color === color ? 'on' : ''}
                                onClick={() => { setColor(item.color); setSize(''); }}
                            >
                                {item.color} <small>({item.total_stock})</small>
                            </button>
                        ))}
                    </div>

                    <p className="sp-label">Size</p>
                    <div className="sp-sizes">
                        {availableSizes.map((s) => (
                            <button
                                type="button"
                                key={`${s.color}-${s.size}`}
                                disabled={s.stock <= 0}
                                className={s.size === size ? 'on' : ''}
                                onClick={() => setSize(s.size)}
                            >
                                {s.size}
                            </button>
                        ))}
                    </div>

                    <p className="sp-stock">
                        {product.total_stock <= 0
                            ? 'Sold out'
                            : chosen
                            ? `${chosen.stock} available in ${color}, size ${chosen.size}`
                            : color
                                ? `${product.colors.find((item) => item.color === color)?.total_stock || 0} available in ${color}. Choose a size.`
                                : `${product.total_stock} available in total. Choose a color to see stock.`}
                    </p>

                    {product.total_stock > 0 && (
                        <div className="sp-actions" style={{ marginTop: 18 }}>
                            <button type="button" className="sp-btn ghost" onClick={() => handleAdd(false)}>
                                Add to cart
                            </button>
                            <button type="button" className="sp-btn" onClick={() => handleAdd(true)}>
                                Buy now
                            </button>
                        </div>
                    )}
                    {readUserRole() !== 'admin' && (
                        <button
                            type="button"
                            className="sp-btn small ghost"
                            style={{ marginTop: 14 }}
                            onClick={askProductQuestion}
                            disabled={questionBusy}
                        >
                            {questionBusy ? 'Opening...' : 'Ask the shop about this product'}
                        </button>
                    )}
                    {addMsg && <p className="sp-muted" style={{ marginTop: 10 }}>{addMsg}</p>}
                </div>
            </div>
        </div>
    );
}

export default ProductDetail;