import { API } from './config';

const call = async (path = '', method = 'GET', body) => {
    const res = await fetch(`${API}/api/cart${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    if (method !== 'GET') window.dispatchEvent(new Event('cart-change'));
    return data;
};

export const fetchCart = () => call();
export const addToCart = (product_id, color, size, quantity = 1) =>
    call('', 'POST', { product_id, color, size, quantity });
export const setQty = (id, quantity) => call(`/${id}`, 'PATCH', { quantity });
export const removeItem = (id) => call(`/${id}`, 'DELETE');
export const startCheckout = () => call('/checkout-start', 'POST');