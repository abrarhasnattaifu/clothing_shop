import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../config';
import './shop.css';

const CATEGORIES = [
    ['T-shirts', 'Everyday comfort for men and women.'],
    ['Shirts', 'Casual and formal shirts.'],
    ['Jeans', 'Regular and slim fits.'],
    ['Panjabi', 'For Eid, weddings and festive days.'],
    ["Women's wear", 'Kurtis, tops and more.']
];

const BENEFITS = [
    ['01', 'Details you can trust', 'Photos from multiple angles and real stock information for every size.'],
    ['02', 'Clear, honest prices', 'See the price and any discount before you decide to order.'],
    ['03', 'Easy ordering', 'Choose your size, add to cart and place your order in a few steps.'],
    ['04', 'Flexible payment', 'Pay by cash on delivery, bKash or Rocket. Mobile payments are checked by our team.'],
    ['05', 'Here when you need us', 'Contact us, request a cancellation before shipping, or ask to return a product.']
];

const VALUES = [
    ['Quality', 'We check what we sell.'],
    ['Affordability', 'Fair prices, honest discounts.'],
    ['Transparency', 'What you see is what you get.'],
    ['Customer care', 'We listen and help make things right.']
];

const STEPS = [
    <>Browse our <Link to="/collections">collections</Link> and choose something you love.</>,
    <>Select your size and add the item to your cart. It is reserved for 30 minutes.</>,
    <>At checkout, enter your delivery details and choose how you want to pay.</>,
    <>We confirm your order and deliver it to your address.</>,
    <>Follow your order any time from <Link to="/orders">My Orders</Link>.</>
];

const FAQ = [
    ['How do I pay?', 'You can pay by cash on delivery, bKash or Rocket. For bKash and Rocket, send the exact total and enter the TrxID at checkout. We check every payment ourselves and confirm your order.'],
    ['How do I choose my size?', 'Pick a size on the product page. Only sizes that are in stock can be selected. If you are unsure, contact us before ordering.'],
    ['How long is an item reserved in my cart?', 'Items in your cart are reserved for 30 minutes. After that they are released so others can buy them.'],
    ['Can I cancel my order?', 'Yes. Go to My Orders and send a cancel request before the order is shipped. We check it, cancel the order and send your money back manually if you already paid.'],
    ['How do returns work?', 'After your order is delivered you have a few days to send a return request with your order code and the problem. We review it and contact you.']
];

function About() {
    const [s, setS] = useState({});

    useEffect(() => {
        fetch(`${API}/api/settings`)
            .then((r) => r.json())
            .then((d) => setS(d.settings || {}))
            .catch(() => {});
    }, []);

    const ext = { target: '_blank', rel: 'noopener noreferrer' };

    return (
        <main className="sp-page about">
            <header className="about-hero">
                <span className="about-eyebrow">WELCOME TO MAMACLOSET</span>
                <h1>Style that feels like you.</h1>
                <p>
                    Thoughtfully chosen everyday fashion, honest prices, and a shopping experience
                    made to feel simple from the first click to delivery.
                </p>
                <Link to="/collections" className="about-hero-link">
                    Explore collections <span aria-hidden="true">→</span>
                </Link>
            </header>

            <section className="about-section">
                <div className="about-intro-grid">
                    <article className="about-panel about-story">
                        <span className="about-kicker">OUR STORY</span>
                        <h2>Good clothes. No guesswork.</h2>
                        <p>
                            MamaCloset started with a simple idea: good clothes should be easy to find,
                            fairly priced and honestly described. We want every customer to shop
                            without confusion and feel happy when the parcel arrives.
                        </p>
                    </article>
                    <article className="about-panel about-mission">
                        <span className="about-kicker">OUR MISSION</span>
                        <h2>Shopping, made comfortable.</h2>
                        <p>To make buying clothes online simple, trustworthy and comfortable for everyone.</p>
                    </article>
                </div>
            </section>

            <section className="about-section">
                <div className="about-section-heading">
                    <span className="about-kicker">FIND YOUR EVERYDAY STYLE</span>
                    <h2>What we offer</h2>
                    <p>Easy-to-wear pieces for everyday moments and special occasions.</p>
                </div>
                <div className="about-grid about-categories">
                    {CATEGORIES.map(([name, text], index) => (
                        <article className="about-card about-category" key={name}>
                            <span className="about-card-number">{String(index + 1).padStart(2, '0')}</span>
                            <strong>{name}</strong>
                            <p>{text}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="about-section">
                <div className="about-section-heading">
                    <span className="about-kicker">THE MAMACLOSET PROMISE</span>
                    <h2>A better way to shop</h2>
                </div>
                <div className="about-grid about-benefits">
                    {BENEFITS.map(([number, title, text]) => (
                        <article className="about-card" key={number}>
                            <span className="about-card-icon">{number}</span>
                            <strong>{title}</strong>
                            <p>{text}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="about-section">
                <div className="about-section-heading">
                    <span className="about-kicker">HOW IT WORKS</span>
                    <h2>Your shopping journey</h2>
                </div>
                <ol className="about-steps">
                    {STEPS.map((step, index) => (
                        <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>
                    ))}
                </ol>
            </section>

            <section className="about-section">
                <div className="about-section-heading">
                    <span className="about-kicker">WHAT MATTERS TO US</span>
                    <h2>Our values</h2>
                </div>
                <div className="about-grid about-values">
                    {VALUES.map(([title, text]) => (
                        <article className="about-card" key={title}>
                            <strong>{title}</strong>
                            <p>{text}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="about-section about-faq-section">
                <div className="about-section-heading">
                    <span className="about-kicker">NEED TO KNOW?</span>
                    <h2>Frequently asked questions</h2>
                </div>
                <div className="about-faq-list">
                    {FAQ.map(([q, a]) => (
                        <details key={q}>
                            <summary>{q}<span aria-hidden="true">+</span></summary>
                            <p>{a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="about-support">
                <div className="about-support-copy">
                    <span className="about-kicker">WE'RE HERE TO HELP</span>
                    <h2>Questions? Talk to us.</h2>
                    <p>Need a hand with an order or have a question before you shop? Reach out—we'd love to help.</p>
                    {s.address && <p className="about-support-address">{s.address}</p>}
                    {s.hours && <p className="about-support-hours">Hours: {s.hours}</p>}
                </div>
                <div className="about-support-links">
                    {s.phone && <a href={`tel:${s.phone.replace(/[\s-]/g, '')}`}><span>Call us</span><strong>{s.phone}</strong></a>}
                    {s.whatsapp && <a href={`https://wa.me/${s.whatsapp}`} {...ext}><span>WhatsApp</span><strong>Message our team ↗</strong></a>}
                    {s.telegram && <a href={`https://t.me/${s.telegram}`} {...ext}><span>Telegram</span><strong>@{s.telegram} ↗</strong></a>}
                    {s.email && <a href={`mailto:${s.email}`}><span>Email</span><strong>{s.email}</strong></a>}
                    {s.facebook && <a href={s.facebook} {...ext}><span>Social</span><strong>Visit our Facebook ↗</strong></a>}
                    {s.delivery_note && <div><span>Delivery</span><strong>{s.delivery_note}</strong></div>}
                    {s.return_note && <div><span>Returns</span><strong>{s.return_note}</strong></div>}
                    <Link to="/returns" className="about-return-link">Return a product <span aria-hidden="true">→</span></Link>
                </div>
            </section>
        </main>
    );
}

export default About;
