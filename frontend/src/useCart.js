import { useCallback, useEffect, useState } from 'react';
import { fetchCart } from './cart';

export default function useCart() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadedAt, setLoadedAt] = useState(Date.now());
    const [now, setNow] = useState(Date.now());

    const load = useCallback(() => {
        return fetchCart()
            .then((d) => {
                setItems(d.items);
                setLoadedAt(Date.now());
                setError('');
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
        window.addEventListener('cart-change', load);
        return () => window.removeEventListener('cart-change', load);
    }, [load]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const withLeft = items.map((i) => ({
        ...i,
        left: Math.max(0, i.seconds_left - Math.floor((now - loadedAt) / 1000))
    }));

    const anyEnded = withLeft.some((i) => i.left === 0);
    useEffect(() => {
        if (anyEnded) load();
    }, [anyEnded, now, load]);

    return { items: withLeft, loading, error };
}