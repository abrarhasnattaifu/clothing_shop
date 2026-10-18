import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, imgUrl, taka } from '../config';
import './Shop.css';

const AUDIENCES = [
    { value: 'all', label: 'All Products' },
    { value: 'men', label: 'Men' },
    { value: 'women', label: 'Women' },
    { value: 'children', label: 'Children' }
];
const PRODUCT_TYPES = [
    { value: 'all', label: 'All types' },
    { value: 'shoes', label: 'Shoes' },
    { value: 'pants', label: 'Pants' },
    { value: 'shirts', label: 'Shirts / Jama' },
    { value: 'other', label: 'Other' }
];
const AUDIENCE_LABELS = { men: 'Men', women: 'Women', children: 'Children', uncategorized: 'Uncategorized' };
const TYPE_LABELS = { shoes: 'Shoes', pants: 'Pants', shirts: 'Shirts / Jama', other: 'Other' };

function stockInfo(total) {
    if (total <= 0) return { text: 'Sold out', cls: 'out' };
    if (total <= 5) return { text: `Only ${total} left`, cls: 'low' };
    return { text: 'In stock', cls: '' };
}

function Collections() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [audience, setAudience] = useState('all');
    const [productType, setProductType] = useState('all');

    useEffect(() => {
        fetch(`${API}/api/products`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not load products.');
                setProducts(data.products);
            })
            .catch((err) =>
                setError(
                    err.message === 'Failed to fetch'
                        ? 'Cannot reach the server. Is the backend running?'
                        : err.message
                )
            )
            .finally(() => setLoading(false));
    }, []);

    const filteredProducts = products.filter((product) =>
        (audience === 'all' || product.audience === audience)
        && (productType === 'all' || product.product_type === productType)
    );

    return (
        <div className="sp-page">
            <h1>Collections</h1>
            <p className="sp-muted">Browse everything or choose a department and product type.</p>

            <div className="collection-filters" aria-label="Filter products">
                <div className="collection-audiences" role="group" aria-label="Choose audience">
                    {AUDIENCES.map((item) => (
                        <button
                            type="button"
                            key={item.value}
                            className={audience === item.value ? 'active' : ''}
                            aria-pressed={audience === item.value}
                            onClick={() => setAudience(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <label className="collection-type-filter">
                    Product type
                    <select value={productType} onChange={(event) => setProductType(event.target.value)}>
                        {PRODUCT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
            </div>

            {loading && <p>Loading...</p>}
            {error && <p className="sp-msg err">{error}</p>}
            {!loading && !error && filteredProducts.length === 0 && <p>No products found in this section yet.</p>}

            <div className="sp-grid">
                {filteredProducts.map((p) => {
                    const stock = stockInfo(p.total_stock);
                    return (
                        <Link to={`/product/${p.id}`} className="sp-card" key={p.id}>
                            <div className="sp-card-img">
                                {p.discount_percent > 0 && (
                                    <span className="sp-badge">-{p.discount_percent}%</span>
                                )}
                                <img src={imgUrl(p.image_front)} alt={p.name} />
                                {p.image_back && (
                                    <img className="alt" src={imgUrl(p.image_back)} alt="" />
                                )}
                            </div>
                            <div className="sp-card-body">
                                <div className="collection-card-categories">
                                    <span>{AUDIENCE_LABELS[p.audience] || 'Uncategorized'}</span>
                                    <span>{TYPE_LABELS[p.product_type] || 'Other'}</span>
                                </div>
                                <p className="sp-card-name">{p.name}</p>
                                <p className="sp-price">
                                    {taka(p.final_price)}
                                    {p.discount_percent > 0 && (
                                        <span className="sp-old">{taka(p.price)}</span>
                                    )}
                                </p>
                                <p className={`sp-stock ${stock.cls}`}>{stock.text}</p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default Collections;