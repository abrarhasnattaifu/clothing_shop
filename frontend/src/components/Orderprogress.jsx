import '@/components/Orderprogress.css';

const stepsFor = (method) => [
    'Order placed',
    method === 'cod' ? 'Confirmed' : 'Payment verified',
    'Shipped',
    'Delivered'
];

const DONE = { pending: 1, confirmed: 2, shipped: 3, delivered: 4 };

const fmtHold = (min) =>
    min >= 60 && min % 60 === 0
        ? `${min / 60} hour${min / 60 > 1 ? 's' : ''}`
        : `${min} minutes`;

const describe = (o, holdMinutes) => {
    const mobile = o.payment_method !== 'cod';
    const status = o.order_status;

    if (status === 'cancelled') {
        if (o.refunded) return 'Cancelled. Your payment has been refunded.';
        if (mobile && ['paid', 'verifying'].includes(o.payment_status)) {
            return o.refund_requested
                ? 'Cancelled. Your refund request is waiting for the shop to review.'
                : 'Cancelled. You can request a refund from this order.';
        }
        if (o.payment_status === 'rejected') {
            return 'Cancelled: we could not confirm your payment. If you already paid, please contact us with your order code.';
        }
        return 'This order was cancelled.';
    }

    if (o.cancel_requested && (status === 'pending' || status === 'confirmed')) {
        return 'You asked to cancel this order. The shop will check it and cancel it soon. If you already paid, the shop will refund you manually.';
    }

    switch (status) {
        case 'pending':
            return `The shop is checking your payment and will confirm your order soon. If it is not confirmed within ${fmtHold(holdMinutes)}, the order is cancelled automatically.`;
        case 'confirmed':
            return mobile
                ? 'Payment received. We are getting your order ready.'
                : 'Your order is confirmed. Please pay in cash when it arrives.';
        case 'shipped':
            return 'Your order is on the way.';
        case 'delivered':
            return 'Delivered. Thank you for shopping with us!';
        default:
            return '';
    }
};

function OrderProgress({ order, holdMinutes = 1440 }) {
    const cancelled = order.order_status === 'cancelled';
    const done = cancelled ? 0 : DONE[order.order_status] || 0;

    return (
        <div className="op">
            <p className={`op-now ${cancelled ? 'bad' : ''}`}>{describe(order, holdMinutes)}</p>

            {!cancelled && (
                <ol className="op-steps">
                    {stepsFor(order.payment_method).map((label, i) => (
                        <li key={label} className={i < done ? 'done' : i === done ? 'now' : ''}>
                            <span className="op-dot">{i < done ? '✓' : i + 1}</span>
                            <span>{label}</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default OrderProgress;