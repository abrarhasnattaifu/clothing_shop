const configuredApi = import.meta.env.VITE_API_URL?.trim();

export const API = (configuredApi || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/+$/, '');

export const imgUrl = (path) => (path ? `${API}${path}` : '');

export const taka = (n) =>
    '৳' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });