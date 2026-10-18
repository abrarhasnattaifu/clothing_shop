import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API } from '@/config';
import '@/pages/shop.css';

function Conversations({ admin = false }) {
    const token = localStorage.getItem('token');
    const [params, setParams] = useSearchParams();
    const selectedId = Number(params.get('conversation')) || null;
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const openedQuery = useRef('');

    const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
    const loadConversations = useCallback(async () => {
        const endpoint = admin ? '/api/conversations/admin/all' : '/api/conversations/mine';
        const response = await fetch(`${API}${endpoint}`, { headers: auth });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load conversations.');
        setConversations(data.conversations);
    }, [admin, auth]);

    const loadMessages = useCallback(async (id) => {
        if (!id) {
            setMessages([]);
            return;
        }
        const response = await fetch(`${API}/api/conversations/${id}/messages`, { headers: auth });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load messages.');
        setMessages(data.messages);
    }, [auth]);

    useEffect(() => {
        let active = true;
        const queryKey = params.get('order')
            ? `order:${params.get('order')}`
            : params.get('product')
                ? `product:${params.get('product')}`
                : '';
        const setup = async () => {
            setLoading(true);
            try {
                if (queryKey && !admin && openedQuery.current !== queryKey) {
                    openedQuery.current = queryKey;
                    const [type, id] = queryKey.split(':');
                    const response = await fetch(`${API}/api/conversations/${type}/${encodeURIComponent(id)}`, {
                        method: 'POST',
                        headers: auth
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Could not open conversation.');
                    if (active) {
                        const next = new URLSearchParams(params);
                        next.delete('order');
                        next.delete('product');
                        next.set('conversation', String(data.conversation_id));
                        setParams(next, { replace: true });
                    }
                }
                await loadConversations();
                await loadMessages(selectedId);
                if (active) setError('');
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        setup();
        const timer = setInterval(() => {
            loadConversations().catch((err) => active && setError(err.message));
            loadMessages(selectedId).catch((err) => active && setError(err.message));
        }, 7000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [admin, auth, loadConversations, loadMessages, params, selectedId, setParams]);

    const chooseConversation = (id) => {
        setParams({ conversation: String(id) });
    };

    const send = async (event) => {
        event.preventDefault();
        if (!selectedId || !text.trim()) return;
        setSending(true);
        setError('');
        try {
            const response = await fetch(`${API}/api/conversations/${selectedId}/messages`, {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not send message.');
            setMessages((items) => [...items, data.message]);
            setText('');
            await loadConversations();
        } catch (err) {
            setError(err.message === 'Failed to fetch' ? 'Cannot reach the server.' : err.message);
        } finally {
            setSending(false);
        }
    };

    const titleFor = (conversation) => conversation.type === 'order'
        ? `Order ${conversation.order_code}`
        : conversation.type === 'product'
            ? `Product: ${conversation.product_name}`
            : 'Chat with the shop';
    const selected = conversations.find((item) => item.id === selectedId);

    return (
        <main className="sp-page">
            <h1>{admin ? 'Buyer conversations' : 'My messages'}</h1>
            <p className="sp-muted">Your conversations stay private between you and the shop.</p>
            {error && <p className="sp-msg err">{error}</p>}
            <div className="conversation-layout">
                <aside className="conversation-list" aria-label="Conversations">
                    {conversations.map((conversation) => (
                        <button
                            type="button"
                            key={conversation.id}
                            className={`conversation-list-item${selectedId === conversation.id ? ' active' : ''}`}
                            onClick={() => chooseConversation(conversation.id)}
                        >
                            <strong>{titleFor(conversation)}</strong>
                            {admin && <small>{conversation.buyer_name} · {conversation.buyer_email}</small>}
                            <span>{conversation.last_message || 'No messages yet'}</span>
                            {!!conversation.unread && <em>{conversation.unread} new</em>}
                        </button>
                    ))}
                    {!loading && conversations.length === 0 && <p className="sp-muted">No conversations yet.</p>}
                </aside>
                <section className="conversation-thread" aria-label="Message thread">
                    {selected ? (
                        <>
                            <header className="conversation-thread-heading">
                                <strong>{titleFor(selected)}</strong>
                                {admin && <small>{selected.buyer_name} · {selected.buyer_email}</small>}
                            </header>
                            <div className="conversation-messages" aria-live="polite">
                                {messages.map((message) => (
                                    <article
                                        key={message.id}
                                        className={`conversation-message${message.sender_role === (admin ? 'admin' : 'buyer') ? ' own' : ''}`}
                                    >
                                        <small>{message.sender_name} · {new Date(message.created_at).toLocaleString()}</small>
                                        <p>{message.message}</p>
                                    </article>
                                ))}
                                {!messages.length && <p className="sp-muted">Start the conversation by sending a message.</p>}
                            </div>
                            <form className="conversation-compose" onSubmit={send}>
                                <label className="sr-only" htmlFor="conversation-message">Your message</label>
                                <textarea
                                    id="conversation-message"
                                    rows={3}
                                    maxLength={2000}
                                    value={text}
                                    onChange={(event) => setText(event.target.value)}
                                    placeholder="Write a message..."
                                    required
                                />
                                <div className="conversation-compose-footer">
                                    <small>{text.length}/2000 · Up to 10 messages per minute</small>
                                    <button className="sp-btn small" disabled={sending || !text.trim()}>
                                        {sending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <p className="sp-muted">{loading ? 'Loading conversations...' : 'Choose a conversation to view messages.'}</p>
                    )}
                </section>
            </div>
        </main>
    );
}

export default Conversations;
