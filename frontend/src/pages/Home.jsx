import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, imgUrl, taka } from '@/config';
import '@/pages/Home.css';

function ProductCard({ product }) {
    const stock = Number(product.total_stock);
    return (
        <Link to={`/product/${product.id}`} className="home-product-card">
            <div className="home-product-image">
                {Number(product.discount_percent) > 0 && (
                    <span className="home-product-discount">-{product.discount_percent}%</span>
                )}
                {product.image_front ? (
                    <img src={imgUrl(product.image_front)} alt={product.name} loading="lazy" />
                ) : (
                    <div className="home-product-placeholder" aria-hidden="true">MamaCloset</div>
                )}
                {product.image_back && (
                    <img className="home-product-alt" src={imgUrl(product.image_back)} alt="" loading="lazy" />
                )}
            </div>
            <div className="home-product-info">
                <h3>{product.name}</h3>
                <p className="home-product-price">
                    {taka(product.final_price)}
                    {Number(product.discount_percent) > 0 && <del>{taka(product.price)}</del>}
                </p>
                <span className={`home-stock${stock <= 0 ? ' sold-out' : stock <= 5 ? ' low' : ''}`}>
                    {stock <= 0 ? 'Sold out' : stock <= 5 ? `Only ${stock} left` : 'In stock'}
                </span>
            </div>
        </Link>
    );
}

function Home() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        fetch(`${API}/api/products`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load products.');
                if (active) setProducts(data.products);
            })
            .catch((err) => {
                if (active) {
                    setError(err.message === 'Failed to fetch'
                        ? 'Cannot reach the shop right now. Please try again.'
                        : err.message);
                }
            })
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, []);

    const arrivals = products.slice(0, 4);
    const popular = useMemo(
        () => {
            const arrivalIds = new Set(products.slice(0, 4).map((product) => product.id));
            return [...products]
                .filter((product) => !arrivalIds.has(product.id))
                .sort((a, b) => Number(b.sold_count) - Number(a.sold_count))
                .slice(0, 4);
        },
        [products]
    );
    const bannerProduct = products[0];

    return (
        <main className="home-page">
            <section className={`home-hero${bannerProduct?.image_front ? ' has-image' : ''}`}>
                {bannerProduct?.image_front && (
                    <img className="home-hero-image" src={imgUrl(bannerProduct.image_front)} alt="" fetchPriority="high" />
                )}
                <div className="home-hero-content">
                    <span className="home-eyebrow">A LITTLE MORE YOU</span>
                    <h1>Find your new<br />favorite look.</h1>
                    <p>Everyday pieces, thoughtful details, and styles that feel like you.</p>
                    <Link className="home-primary-button" to="/collections">
                        Shop the collection <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </section>

            <section className="home-section">
                <div className="home-section-heading">
                    <div>
                        <span className="home-eyebrow">FRESH FROM THE SHOP</span>
                        <h2>New arrivals</h2>
                    </div>
                    <Link to="/collections" className="home-text-link">View all <span aria-hidden="true">→</span></Link>
                </div>
                {loading && <p className="home-state">Finding the latest pieces...</p>}
                {error && <p className="home-state error" role="alert">{error}</p>}
                {!loading && !error && arrivals.length > 0 && (
                    <div className="home-products-grid">
                        {arrivals.map((product) => <ProductCard product={product} key={product.id} />)}
                    </div>
                )}
                {!loading && !error && !arrivals.length && (
                    <p className="home-state">New styles are on the way. Check back soon.</p>
                )}
            </section>

            {!loading && !error && popular.length > 0 && (
                <section className="home-section">
                    <div className="home-section-heading">
                        <div>
                            <span className="home-eyebrow">LOVED BY SHOPPERS</span>
                            <h2>Popular picks</h2>
                        </div>
                        <Link to="/collections" className="home-text-link">View all <span aria-hidden="true">→</span></Link>
                    </div>
                    <div className="home-products-grid">
                        {popular.map((product) => <ProductCard product={product} key={product.id} />)}
                    </div>
                </section>
            )}
        </main>
    );
}

export default Home;
