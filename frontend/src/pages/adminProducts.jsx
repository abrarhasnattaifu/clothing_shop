import { useEffect, useState } from 'react';
import { API, imgUrl, taka } from '@/config';
import '@/pages/shop.css';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const emptyForm = {
    name: '',
    audience: 'men',
    product_type: 'other',
    description: '',
    price: '',
    discount_percent: '0',
    is_active: true
};
const emptyStock = () => Object.fromEntries(SIZES.map((s) => [s, '']));
const emptyColor = () => ({ color: '', stock: emptyStock() });
const emptyFiles = { front: null, back: null, side: null };

function AdminProducts() {
    const token = localStorage.getItem('token');
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [colors, setColors] = useState([emptyColor()]);
    const [files, setFiles] = useState(emptyFiles);
    const [fileKey, setFileKey] = useState(0);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const loadProducts = async () => {
        try {
            const res = await fetch(`${API}/api/products/admin/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setProducts(data.products);
        } catch {
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const resetForm = () => {
        setForm(emptyForm);
        setColors([emptyColor()]);
        setFiles(emptyFiles);
        setFileKey((k) => k + 1);
        setEditingId(null);
    };

    const startEdit = (p) => {
        setEditingId(p.id);
        setForm({
            name: p.name,
            audience: p.audience || 'uncategorized',
            product_type: p.product_type || 'other',
            description: p.description || '',
            price: String(p.price),
            discount_percent: String(p.discount_percent),
            is_active: p.is_active
        });
        const groupedColors = new Map();
        (p.variants || p.sizes.map((variant) => ({ ...variant, color: 'Default' }))).forEach((variant) => {
            if (!groupedColors.has(variant.color)) groupedColors.set(variant.color, emptyStock());
            groupedColors.get(variant.color)[variant.size] = String(variant.stock);
        });
        setColors(Array.from(groupedColors, ([color, stock]) => ({ color, stock })));
        setFiles(emptyFiles);
        setFileKey((k) => k + 1);
        setMessage('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setIsError(false);

        try {
            const sizes = colors.flatMap((entry) =>
                SIZES.filter((size) => entry.color.trim() && entry.stock[size] !== '')
                    .map((size) => ({ color: entry.color.trim(), size, stock: Number(entry.stock[size]) }))
            );
            if (!sizes.length) throw new Error('Add at least one color and size stock.');

            const body = new FormData();
            body.append('name', form.name);
            body.append('audience', form.audience);
            body.append('product_type', form.product_type);
            body.append('description', form.description);
            body.append('price', form.price);
            body.append('discount_percent', form.discount_percent || 0);
            body.append('is_active', form.is_active);
            body.append('sizes', JSON.stringify(sizes));
            ['front', 'back', 'side'].forEach((k) => {
                if (files[k]) body.append(k, files[k]);
            });

            const res = await fetch(
                editingId ? `${API}/api/products/${editingId}` : `${API}/api/products`,
                {
                    method: editingId ? 'PUT' : 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body
                }
            );
            const data = await res.json();

            if (!res.ok) {
                setIsError(true);
                setMessage(data.error || 'Something went wrong.');
            } else {
                setMessage(data.message);
                resetForm();
                loadProducts();
            }
        } catch (error) {
            setIsError(true);
            setMessage(error.message === 'Failed to fetch'
                ? 'Cannot reach the server. Is the backend running?'
                : error.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteProduct = async (product) => {
        const confirmed = window.confirm(
            `Permanently delete "${product.name}"? This also removes its images and any active cart reservations. Products linked to past orders or messages cannot be deleted.`
        );
        if (!confirmed) return;

        setDeletingId(product.id);
        setMessage('');
        setIsError(false);
        try {
            const res = await fetch(`${API}/api/products/${product.id}`, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not delete this product.');
            setMessage(data.message);
            if (editingId === product.id) resetForm();
            await loadProducts();
        } catch (error) {
            setIsError(true);
            setMessage(error.message === 'Failed to fetch'
                ? 'Cannot reach the server. Is the backend running?'
                : error.message);
        } finally {
            setDeletingId(null);
        }
    };

    const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });
    const setFile = (key) => (e) => setFiles({ ...files, [key]: e.target.files[0] || null });

    return (
        <div className="sp-page">
            <h1>{editingId ? 'Edit product' : 'Add a new product'}</h1>

            {message && <p className={`sp-msg ${isError ? 'err' : 'ok'}`}>{message}</p>}

            <form className="sp-form" onSubmit={handleSubmit}>
                <label>
                    Product name
                    <input value={form.name} onChange={setField('name')} maxLength={150} required />
                </label>

                <div className="sp-row">
                    <label>
                        Audience category
                        <select value={form.audience} onChange={setField('audience')} required>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="children">Children</option>
                            {form.audience === 'uncategorized' && <option value="uncategorized">Uncategorized</option>}
                        </select>
                    </label>
                    <label>
                        Product type
                        <select value={form.product_type} onChange={setField('product_type')} required>
                            <option value="shoes">Shoes</option>
                            <option value="pants">Pants</option>
                            <option value="shirts">Shirts / Jama</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                </div>

                <label>
                    Description
                    <textarea
                        rows={4}
                        value={form.description}
                        onChange={setField('description')}
                        maxLength={2000}
                    />
                </label>

                <div className="sp-row">
                    <label>
                        Price (৳)
                        <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={form.price}
                            onChange={setField('price')}
                            required
                        />
                    </label>
                    <label>
                        Discount (%) <small>0 mane discount nei</small>
                        <input
                            type="number"
                            min="0"
                            max="90"
                            step="1"
                            value={form.discount_percent}
                            onChange={setField('discount_percent')}
                        />
                    </label>
                </div>

                <div>
                    <p className="sp-label">
                        Stock by color and size <small>(color name diye oi color-er available size-er stock din)</small>
                    </p>
                    <div className="admin-color-inventory">
                        {colors.map((entry, colorIndex) => (
                            <fieldset className="admin-color-group" key={colorIndex}>
                                <legend>Color {colorIndex + 1}</legend>
                                <div className="admin-color-heading">
                                    <label>
                                        Color name
                                        <input
                                            value={entry.color}
                                            onChange={(event) => setColors((items) => items.map((item, index) =>
                                                index === colorIndex ? { ...item, color: event.target.value } : item
                                            ))}
                                            maxLength={40}
                                            placeholder="e.g. Black"
                                            required={SIZES.some((size) => entry.stock[size] !== '')}
                                        />
                                    </label>
                                    {colors.length > 1 && (
                                        <button
                                            type="button"
                                            className="sp-btn small ghost"
                                            onClick={() => setColors((items) => items.filter((_, index) => index !== colorIndex))}
                                        >
                                            Remove color
                                        </button>
                                    )}
                                </div>
                                <div className="sp-stock-grid">
                                    {SIZES.map((size) => (
                                        <label key={size}>
                                            {size}
                                            <input
                                                type="number"
                                                min="0"
                                                max="100000"
                                                step="1"
                                                value={entry.stock[size]}
                                                onChange={(event) => setColors((items) => items.map((item, index) =>
                                                    index === colorIndex
                                                        ? { ...item, stock: { ...item.stock, [size]: event.target.value } }
                                                        : item
                                                ))}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                        <button type="button" className="sp-btn small ghost" onClick={() => setColors((items) => [...items, emptyColor()])}>
                            Add another color
                        </button>
                    </div>
                </div>

                <div className="sp-row three" key={fileKey}>
                    <label>
                        Front photo {editingId ? '(optional)' : '*'}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={setFile('front')}
                            required={!editingId}
                        />
                    </label>
                    <label>
                        Back photo
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={setFile('back')} />
                    </label>
                    <label>
                        Side photo
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={setFile('side')} />
                    </label>
                </div>
                <small>JPG, PNG ba WEBP. Prottek chobi 3 MB er kom.</small>

                <label className="sp-check">
                    <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Show this product in the shop
                </label>

                <div className="sp-actions">
                    <button type="submit" className="sp-btn" disabled={loading}>
                        {loading ? 'Saving...' : editingId ? 'Save changes' : 'Add product'}
                    </button>
                    {editingId && (
                        <button type="button" className="sp-btn ghost" onClick={resetForm} disabled={loading}>
                            Cancel edit
                        </button>
                    )}
                </div>
            </form>

            <h2 className="sp-h2">All products</h2>
            {products.length === 0 ? (
                <p>No products yet.</p>
            ) : (
                <div className="sp-table-wrap">
                    <table className="sp-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Name</th>
                                <th>Audience</th>
                                <th>Type</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Sold</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <img src={imgUrl(p.image_front)} alt="" className="sp-thumb" />
                                    </td>
                                    <td>{p.name}</td>
                                    <td>{({ men: 'Men', women: 'Women', children: 'Children', uncategorized: 'Uncategorized' })[p.audience] || 'Uncategorized'}</td>
                                    <td>{({ shoes: 'Shoes', pants: 'Pants', shirts: 'Shirts / Jama', other: 'Other' })[p.product_type] || 'Other'}</td>
                                    <td>
                                        {taka(p.final_price)}
                                        {p.discount_percent > 0 && (
                                            <small> (-{p.discount_percent}%)</small>
                                        )}
                                    </td>
                                    <td>
                                        <div className="admin-stock-list">
                                            {Array.from(
                                                (p.variants || p.sizes.map((variant) => ({ ...variant, color: 'Default' })))
                                                    .reduce((groups, variant) => {
                                                        if (!groups.has(variant.color)) groups.set(variant.color, []);
                                                        groups.get(variant.color).push(variant);
                                                        return groups;
                                                    }, new Map()),
                                                ([color, variants]) => (
                                                    <div className="admin-stock-color" key={color}>
                                                        <strong>{color}</strong>
                                                        <div className="admin-stock-sizes">
                                                            {variants.map((variant) => (
                                                                <span
                                                                    className={`admin-stock-size${variant.stock <= 0 ? ' empty' : ''}`}
                                                                    key={`${color}-${variant.size}`}
                                                                >
                                                                    {variant.size}<b>{variant.stock}</b>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </td>
                                    <td>{p.sold_count}</td>
                                    <td>{p.is_active ? 'Visible' : 'Hidden'}</td>
                                    <td>
                                        <button type="button" className="sp-btn small" onClick={() => startEdit(p)}>
                                            Edit
                                        </button>
                                        {' '}
                                        <button
                                            type="button"
                                            className="sp-btn small ghost"
                                            disabled={deletingId === p.id || loading}
                                            onClick={() => deleteProduct(p)}
                                        >
                                            {deletingId === p.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default AdminProducts;
