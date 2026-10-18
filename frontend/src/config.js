export const API = 'http://localhost:5000';

export const imgUrl = (path) => (path ? `${API}${path}` : '');

export const taka = (n) =>
    '৳' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });