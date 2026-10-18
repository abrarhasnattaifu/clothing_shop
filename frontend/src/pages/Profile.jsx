import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '@/config';
import '@/pages/Profile.css';

function Profile({ onProfileUpdated }) {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [activities, setActivities] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        let active = true;
        fetch(`${API}/api/profile/me`, { headers: { Authorization: ['Bearer', token].join(' ') } })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load profile.');
                if (active) {
                    setProfile(data.profile);
                    setActivities(data.activities);
                    setHasMore(data.has_more);
                }
            })
            .catch((err) => active && setError(err.message))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [token]);

    const loadMoreActivities = async () => {
        setLoadingMore(true);
        setError('');
        try {
            const response = await fetch(`${API}/api/profile/me?offset=${activities.length}`, {
                headers: { Authorization: ['Bearer', token].join(' ') }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load more activity.');
            setActivities((items) => [...items, ...data.activities]);
            setHasMore(data.has_more);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingMore(false);
        }
    };

    const save = async (event) => {
        event.preventDefault();
        if (!profile) return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const form = new FormData();
            form.set('name', profile.name);
            form.set('phone', profile.phone || '');
            form.set('address', profile.address || '');
            if (photo) form.set('profile_image', photo);
            const response = await fetch(`${API}/api/profile/me`, {
                method: 'PUT',
                headers: { Authorization: ['Bearer', token].join(' ') },
                body: form
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save profile.');
            setProfile(data.profile);
            setPhoto(null);
            setNotice(data.message);
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            if (user) {
                user.name = data.profile.name;
                user.profile_image = data.profile.profile_image;
                localStorage.setItem('user', JSON.stringify(user));
                onProfileUpdated(user);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const openGeneralChat = async () => {
        setChatLoading(true);
        setError('');
        try {
            const response = await fetch(`${API}/api/conversations/general`, {
                method: 'POST',
                headers: { Authorization: ['Bearer', token].join(' ') }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not open chat.');
            navigate(`/messages?conversation=${data.conversation_id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setChatLoading(false);
        }
    };

    if (loading) return <main className="profile-page"><p>Loading profile...</p></main>;
    if (!profile) return <main className="profile-page"><p className="profile-error">{error || 'Profile unavailable.'}</p></main>;

    return (
        <main className="profile-page">
            <header className="profile-heading">
                <div>
                    <span className="profile-eyebrow">YOUR ACCOUNT</span>
                    <h1>Profile</h1>
                    <p>Keep your contact details up to date and review your shop activity.</p>
                </div>
                {profile.role === 'buyer' && (
                    <button className="profile-chat-button" type="button" onClick={openGeneralChat} disabled={chatLoading}>
                        {chatLoading ? 'Opening chat...' : 'Chat with the shop'}
                    </button>
                )}
            </header>

            {error && <p className="profile-error" role="alert">{error}</p>}
            {notice && <p className="profile-success" role="status">{notice}</p>}

            <div className="profile-grid">
                <section className="profile-card">
                    <h2>Personal information</h2>
                    <form onSubmit={save}>
                        <div className="profile-photo-row">
                            {profile.profile_image ? (
                                <img className="profile-photo" src={`${API}${profile.profile_image}`} alt="Your profile" />
                            ) : (
                                <div className="profile-photo profile-photo-placeholder" aria-hidden="true">
                                    {profile.name.slice(0, 1).toUpperCase()}
                                </div>
                            )}
                            <label className="profile-photo-label">
                                Profile photo
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) => setPhoto(event.target.files?.[0] || null)}
                                />
                                <small>JPG, PNG, or WEBP · up to 3 MB</small>
                            </label>
                        </div>

                        <label className="profile-field">
                            Full name
                            <input
                                value={profile.name || ''}
                                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                                maxLength={100}
                                required
                            />
                        </label>
                        <label className="profile-field">
                            Email
                            <input type="email" value={profile.email || ''} readOnly />
                            <small>Email is read-only because it is used for login and verification.</small>
                        </label>
                        <label className="profile-field">
                            Phone number
                            <input
                                type="tel"
                                value={profile.phone || ''}
                                onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                                maxLength={20}
                                autoComplete="tel"
                            />
                        </label>
                        <label className="profile-field">
                            Address
                            <textarea
                                value={profile.address || ''}
                                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                                maxLength={500}
                                rows={3}
                                autoComplete="street-address"
                            />
                        </label>
                        <button className="profile-save-button" type="submit" disabled={saving}>
                            {saving ? 'Saving...' : 'Save profile'}
                        </button>
                    </form>
                </section>

                <section className="profile-card profile-activity">
                    <div className="profile-section-heading">
                        <div>
                            <h2>Your activity</h2>
                            <p>Recent orders, returns, messages, and notifications.</p>
                        </div>
                    </div>
                    {activities.length ? (
                        <ol className="profile-activity-list">
                            {activities.map((item, index) => (
                                <li key={`${item.activity_type}-${item.created_at}-${index}`}>
                                    <span className="profile-activity-dot" aria-hidden="true" />
                                    <div>
                                        <div className="profile-activity-title">
                                            <strong>{item.activity_type}</strong>
                                            {item.reference && <span>{item.reference}</span>}
                                        </div>
                                        <p>{item.description}</p>
                                        <time dateTime={item.created_at}>
                                            {new Date(item.created_at).toLocaleString()}
                                        </time>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="profile-empty">Your activity will appear here as you use the shop.</p>
                    )}
                    {hasMore && (
                        <button
                            className="profile-more-button"
                            type="button"
                            onClick={loadMoreActivities}
                            disabled={loadingMore}
                        >
                            {loadingMore ? 'Loading...' : 'Load more activity'}
                        </button>
                    )}
                </section>
            </div>
        </main>
    );
}

export default Profile;
