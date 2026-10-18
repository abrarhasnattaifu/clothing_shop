import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, imgUrl, taka } from '../config';
import './dashboard.css';

const STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Completed',
    cancelled: 'Cancelled'
};

const formatDate = (value) => new Date(value).toLocaleString();

function StatCard({ label, value, detail, tone = '' }) {
    return (
        <article className={`dashboard-stat ${tone}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            {detail && <small>{detail}</small>}
        </article>
    );
}

function Dashboard({ user }) {
    const isAdmin = user?.role === 'admin';
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API}/api/dashboard/${isAdmin ? 'admin' : 'buyer'}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load the dashboard.');
                if (active) {
                    setData(result);
                    setError('');
                }
            } catch (err) {
                if (active) setError(err.message === 'Failed to fetch'
                    ? 'Cannot reach the server. Is the backend running?'
                    : err.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [isAdmin]);

    if (loading) return <main className="dashboard-page"><p>Loading dashboard...</p></main>;

    return (
        <main className="dashboard-page">
            <header className="dashboard-heading">
                <div>
                    <span className="dashboard-eyebrow">{isAdmin ? 'SHOP OVERVIEW' : 'YOUR ACCOUNT'}</span>
                    <h1>{isAdmin ? 'Admin dashboard' : `Welcome${user?.name ? `, ${user.name}` : ''}`}</h1>
                    <p>{isAdmin ? 'A quick view of sales, orders, inventory and shop activity.' : 'Your orders and shopping activity at a glance.'}</p>
                </div>
                <span className={`dashboard-role ${isAdmin ? 'admin' : 'buyer'}`}>{isAdmin ? 'Admin' : 'Buyer'}</span>
            </header>

            {error && <p className="dashboard-error" role="alert">{error}</p>}
            {!error && data && (isAdmin ? (
                <AdminDashboard data={data} />
            ) : (
                <BuyerDashboard data={data} />
            ))}
        </main>
    );
}

function BuyerDashboard({ data }) {
    const { summary, recent_orders: recentOrders, order_status: orderStatus, products } = data;
    const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const totalStatuses = Object.values(orderStatus).reduce((sum, count) => sum + count, 0);

    return (
        <>
            <section className="dashboard-stats" aria-label="Your order summary">
                <StatCard label="Total orders" value={summary.total_orders} />
                <StatCard label="Pending orders" value={summary.pending_orders} tone="warning" />
                <StatCard label="Completed orders" value={summary.completed_orders} tone="success" />
                <StatCard label="Total spending" value={taka(summary.total_spending)} tone="accent" detail="Paid orders, excluding cancellations and refunds" />
            </section>

            <div className="dashboard-columns">
                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">ORDER ACTIVITY</span><h2>Order status summary</h2></div>
                        <Link to="/orders">View all</Link>
                    </div>
                    <div className="dashboard-status-list">
                        {statusOrder.map((status) => {
                            const count = orderStatus[status] || 0;
                            const width = totalStatuses ? `${(count / totalStatuses) * 100}%` : '0%';
                            return (
                                <div className="dashboard-status-row" key={status}>
                                    <span>{STATUS_LABELS[status]}</span>
                                    <div className="dashboard-status-track"><span style={{ width }} /></div>
                                    <strong>{count}</strong>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">YOUR ACTIVITY</span><h2>Recent orders</h2></div>
                        <Link to="/orders">My orders</Link>
                    </div>
                    {recentOrders.length ? (
                        <div className="dashboard-order-list">
                            {recentOrders.map((order) => (
                                <article className="dashboard-order-row" key={order.order_code}>
                                    <div>
                                        <strong>{order.order_code}</strong>
                                        <small>{formatDate(order.created_at)}</small>
                                    </div>
                                    <div className="dashboard-order-meta">
                                        <span className={`dashboard-status-pill ${order.order_status}`}>{STATUS_LABELS[order.order_status] || order.order_status}</span>
                                        <strong>{taka(order.total)}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="dashboard-empty"><p>No orders yet.</p><Link to="/collections">Explore collections</Link></div>
                    )}
                </section>
            </div>

            <section className="dashboard-panel dashboard-products-panel">
                <div className="dashboard-panel-heading">
                    <div><span className="dashboard-eyebrow">PICKED FOR YOU</span><h2>Explore products</h2></div>
                    <Link to="/collections">All products</Link>
                </div>
                {products.length ? (
                    <div className="dashboard-products">
                        {products.map((product) => (
                            <Link className="dashboard-product" to={`/product/${product.id}`} key={product.id}>
                                <img src={imgUrl(product.image_front)} alt={product.name} />
                                <div>
                                    <strong>{product.name}</strong>
                                    <span>{taka(product.final_price)}</span>
                                    <small>{product.total_stock > 0 ? `${product.total_stock} in stock` : 'Sold out'}</small>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : <p className="dashboard-empty">No products available right now.</p>}
            </section>
        </>
    );
}

function AdminDashboard({ data }) {
    const { summary, recent_orders: recentOrders, recent_activities: recentActivities, low_stock: lowStock } = data;

    return (
        <>
            <section className="dashboard-stats admin-stats" aria-label="Shop summary">
                <StatCard label="Total sales" value={taka(summary.total_sales)} tone="success" detail="Paid orders, excluding cancelled and refunded" />
                <StatCard label="Total order amount" value={taka(summary.total_order_amount)} tone="accent" detail="All non-cancelled orders, including unpaid" />
                <StatCard label="Total orders" value={summary.total_orders} />
                <StatCard label="Total products" value={summary.total_products} />
                <StatCard label="Total customers" value={summary.total_customers} />
                <StatCard label="Pending orders" value={summary.pending_orders} tone="warning" />
                <StatCard label="Low stock products" value={summary.low_stock_products} tone="danger" detail="Active products with 5 or fewer units" />
            </section>

            <div className="dashboard-columns">
                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">LATEST ORDERS</span><h2>5 recent received orders</h2></div>
                        <Link to="/admin/orders">Manage orders</Link>
                    </div>
                    {recentOrders.length ? (
                        <div className="dashboard-order-list">
                            {recentOrders.map((order) => (
                                <article className="dashboard-order-row admin-order-row" key={order.id}>
                                    <div>
                                        <strong>{order.order_code}</strong>
                                        <small>{order.customer_name} · {formatDate(order.created_at)}</small>
                                    </div>
                                    <div className="dashboard-order-meta">
                                        <span className={`dashboard-status-pill ${order.order_status}`}>{STATUS_LABELS[order.order_status] || order.order_status}</span>
                                        <strong>{taka(order.total)}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : <p className="dashboard-empty">No orders have been received yet.</p>}
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">INVENTORY</span><h2>Low stock products</h2></div>
                        <Link to="/admin/products">Manage products</Link>
                    </div>
                    {lowStock.length ? (
                        <div className="dashboard-order-list">
                            {lowStock.map((product) => (
                                <article className="dashboard-order-row" key={product.id}>
                                    <strong>{product.name}</strong>
                                    <span className={`dashboard-stock-count${product.total_stock === 0 ? ' empty' : ''}`}>
                                        {product.total_stock === 0 ? 'Out of stock' : `${product.total_stock} left`}
                                    </span>
                                </article>
                            ))}
                        </div>
                    ) : <p className="dashboard-empty">No products are low on stock.</p>}
                </section>
            </div>

            <section className="dashboard-panel dashboard-activities">
                <div className="dashboard-panel-heading">
                    <div><span className="dashboard-eyebrow">SHOP UPDATES</span><h2>Recent activities</h2></div>
                    <Link to="/admin/orders">Open orders</Link>
                </div>
                {recentActivities.length ? (
                    <div className="dashboard-order-list">
                        {recentActivities.map((activity) => (
                            <article className="dashboard-order-row" key={activity.id}>
                                <div><strong>{activity.message}</strong><small>{formatDate(activity.created_at)}</small></div>
                                {activity.order_id && <Link to="/admin/orders">Order details</Link>}
                            </article>
                        ))}
                    </div>
                ) : <p className="dashboard-empty">No recent activity.</p>}
            </section>
        </>
    );
}

export default Dashboard;
