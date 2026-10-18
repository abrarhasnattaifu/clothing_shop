import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/config';
import '@/components/Footer.css';

function Footer() {
    const [s, setS] = useState({});

    useEffect(() => {
        const load = () =>
            fetch(`${API}/api/settings`)
                .then((r) => r.json())
                .then((d) => setS(d.settings || {}))
                .catch(() => {});
        load();
        window.addEventListener('settings-change', load);
        return () => window.removeEventListener('settings-change', load);
    }, []);

    const ext = { target: '_blank', rel: 'noopener noreferrer' };

    return (
        <footer className="footer">
            <div className="footer-grid">
                <div>
                    <Link to="/" className="footer-logo">MamaCloset<span>.</span></Link>
                    <p className="footer-text">
                        {s.shop_about || 'Quality clothing for everyday style.'}
                    </p>
                    {(s.facebook || s.instagram) && (
                        <div className="footer-social">
                            {s.facebook && <a href={s.facebook} {...ext}>Facebook</a>}
                            {s.instagram && <a href={s.instagram} {...ext}>Instagram</a>}
                        </div>
                    )}
                </div>

                <div>
                    <h3>Quick links</h3>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/collections">Collections</Link></li>
                        <li><Link to="/cart">Cart</Link></li>
                        <li><Link to="/orders">My Orders</Link></li>
                        <li><Link to="/about">About us</Link></li>
                        <li><Link to="/returns">Return product</Link></li>
                    </ul>
                </div>

                <div>
                    <h3>Customer care</h3>
                    <ul>
                        <li>Payment: Cash on delivery, bKash, Rocket</li>
                        {s.delivery_note && <li>Delivery: {s.delivery_note}</li>}
                        {s.return_note && <li>Returns: {s.return_note}</li>}
                    </ul>
                </div>

                <div>
                    <h3>Contact us</h3>
                    <ul>
                        {s.phone && <li>Phone: <a href={`tel:${s.phone.replace(/[\s-]/g, '')}`}>{s.phone}</a></li>}
                        {s.whatsapp && <li>WhatsApp: <a href={`https://wa.me/${s.whatsapp}`} {...ext}>+{s.whatsapp}</a></li>}
                        {s.telegram && <li>Telegram: <a href={`https://t.me/${s.telegram}`} {...ext}>@{s.telegram}</a></li>}
                        {s.email && <li>Email: <a href={`mailto:${s.email}`}>{s.email}</a></li>}
                        {s.address && <li>{s.address}</li>}
                        {s.hours && <li>Open: {s.hours}</li>}
                    </ul>
                </div>
            </div>

            <div className="footer-bottom">
                &copy; {new Date().getFullYear()} MamaCloset. All rights reserved.
            </div>
        </footer>
    );
}

export default Footer;