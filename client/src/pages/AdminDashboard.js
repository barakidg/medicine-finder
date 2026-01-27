import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import axios from 'axios';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('pharmacies');
    const [pharmacies, setPharmacies] = useState([]);
    const [users, setUsers] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Memoize the fetch function so it doesn't trigger unnecessary re-renders
    const fetchAdminData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (activeTab === 'pharmacies') {
                const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/admin/pharmacies', config);
                setPharmacies(res.data);
            } else if (activeTab === 'doctors') {
                const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/admin/users', config);
                // Filter to show only doctors
                setUsers(res.data.filter(u => u.role === 'Doctor'));
            } else if (activeTab === 'users') {
                const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/admin/users', config);
                setUsers(res.data);
            } else if (activeTab === 'feedback') {
                const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/admin/feedback', config);
                setFeedback(res.data);
            }
        } catch (err) {
            console.error("Error fetching admin data", err);
            if (err.response) {
                alert("Error: " + (err.response.data?.error || err.response.statusText));
            } else {
                alert("Error fetching data. Please check console for details.");
            }
        }
        setLoading(false);
    }, [activeTab]); // fetchAdminData depends on activeTab

    useEffect(() => {
        fetchAdminData();
    }, [fetchAdminData]); // Now the dependency is stable

    const handleVerifyPharmacy = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/admin/pharmacies/${id}/verify`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Pharmacy verified successfully!");
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) { alert("Verification failed"); }
    };

    const handleVerifyDoctor = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/admin/doctors/${id}/verify`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Doctor verified successfully!");
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) { alert("Verification failed"); }
    };

    const handleUserStatusChange = async (id, status) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/admin/users/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`User ${status === 'active' ? 'reactivated' : status} successfully!`);
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) {
            alert("Action failed: " + (err.response?.data?.error || err.message));
        }
    };

    const handlePharmacyStatusChange = async (id, status) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/admin/pharmacies/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Pharmacy ${status === 'active' ? 'reactivated' : status} successfully!`);
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) {
            alert("Action failed: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteUser = async (id) => {
        const ok = window.confirm('Delete this user from the database? This cannot be undone.');
        if (!ok) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`https://medicine-finder-yej7.onrender.com/api/admin/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('User deleted successfully.');
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) {
            alert("Delete failed: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeletePharmacy = async (id) => {
        const ok = window.confirm('Delete this pharmacy from the database? This will also delete its inventory and feedback. This cannot be undone.');
        if (!ok) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`https://medicine-finder-yej7.onrender.com/api/admin/pharmacies/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Pharmacy deleted successfully.');
            fetchAdminData();
            // Refresh search if active
            if (searchQuery.trim()) {
                handleSearch({ preventDefault: () => { } });
            }
        } catch (err) {
            alert("Delete failed: " + (err.response?.data?.error || err.message));
        }
    };

    const getStatusBadge = (status) => {
        if (!status || status === 'active') return { text: '✅ Active', color: '#28a745' };
        if (status === 'suspended') return { text: '⚠️ Suspended', color: '#ffc107' };
        if (status === 'banned') return { text: '🚫 Banned', color: '#dc3545' };
        return { text: '❓ Unknown', color: '#6c757d' };
    };

    const handleModerateFeedback = async (id, action) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/admin/feedback/${id}`, { status: action }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAdminData();
        } catch (err) { alert("Action failed"); }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`https://medicine-finder-yej7.onrender.com/api/admin/users/search?query=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(res.data);
        } catch (err) {
            alert("Search failed: " + (err.response?.data?.error || err.message));
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    };

    return (
        <div style={styles.container}>
            <h1>System Administration Portal</h1>

            {/* Admin Search Bar */}
            <div style={styles.searchSection}>
                <form onSubmit={handleSearch} style={styles.searchForm}>
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.searchInput}
                    />
                    <button type="submit" style={styles.searchBtn} disabled={isSearching}>
                        {isSearching ? 'Searching...' : '🔍 Search'}
                    </button>
                    {searchResults.length > 0 && (
                        <button type="button" onClick={clearSearch} style={styles.clearBtn}>
                            Clear
                        </button>
                    )}
                </form>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div style={styles.searchResultsSection}>
                    <h2 style={styles.searchResultsTitle}>Search Results ({searchResults.length})</h2>
                    {searchResults.map(user => {
                        const statusBadge = getStatusBadge(user.status);
                        // Patient: Show like user management
                        if (user.role === 'Patient') {
                            return (
                                <div key={user.user_id} style={styles.searchResultCard}>
                                    <table style={styles.searchTable}>
                                        <thead>
                                            <tr style={{ background: '#f8f9fa' }}>
                                                <th style={styles.th}>Name</th>
                                                <th style={styles.th}>Email</th>
                                                <th style={styles.th}>Role</th>
                                                <th style={styles.th}>Verification</th>
                                                <th style={styles.th}>Status</th>
                                                <th style={styles.th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ background: user.status === 'banned' ? '#fff5f5' : user.status === 'suspended' ? '#fffbf0' : 'white' }}>
                                                <td style={styles.td}>{user.full_name}</td>
                                                <td style={styles.td}>{user.email}</td>
                                                <td style={styles.td}>{user.role}</td>
                                                <td style={styles.td}>{user.verified ? "✅ Verified" : "⏳ Pending"}</td>
                                                <td style={styles.td}>
                                                    <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                        {statusBadge.text}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.actionGroup}>
                                                        {user.status === 'banned' ? (
                                                            <>
                                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                    Unban
                                                                </button>
                                                                <button onClick={() => { handleDeleteUser(user.user_id); }} style={styles.deleteDangerBtn}>
                                                                    Delete
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {user.status !== 'suspended' && (
                                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'suspended'); }} style={styles.suspendBtn}>
                                                                        Suspend
                                                                    </button>
                                                                )}
                                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'banned'); }} style={styles.banBtn}>
                                                                    Ban
                                                                </button>
                                                                {user.status === 'suspended' && (
                                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                        Reactivate
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        }
                        // Pharmacist: Show with pharmacy info and verification options
                        if (user.role === 'Pharmacist') {
                            const pharmacyStatusBadge = getStatusBadge(user.pharmacy_status);
                            return (
                                <div key={user.user_id} style={styles.searchResultCard}>
                                    <h3 style={styles.resultHeader}>Pharmacist: {user.full_name}</h3>
                                    <div style={styles.pharmacistInfo}>
                                        <p><strong>Email:</strong> {user.email}</p>
                                        <p><strong>Phone:</strong> {user.phone_number || 'N/A'}</p>
                                        <p><strong>User Status:</strong> <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>{statusBadge.text}</span></p>
                                        <p><strong>User Verification:</strong> {user.verified ? "✅ Verified" : "⏳ Pending"}</p>
                                    </div>
                                    {user.pharmacy_name && (
                                        <div style={styles.pharmacyInfoBox}>
                                            <h4 style={styles.pharmacyTitle}>Pharmacy Information</h4>
                                            <p><strong>Name:</strong> {user.pharmacy_name}</p>
                                            <p><strong>Address:</strong> {user.pharmacy_address}</p>
                                            <p><strong>Contact:</strong> {user.pharmacy_contact || 'N/A'}</p>
                                            <p><strong>Pharmacy Status:</strong> <span style={{ color: pharmacyStatusBadge.color, fontWeight: 'bold' }}>{pharmacyStatusBadge.text}</span></p>
                                            <p><strong>Pharmacy Verification:</strong> {user.pharmacy_verified ? "✅ Verified" : "⏳ Pending"}</p>
                                        </div>
                                    )}
                                    <div style={styles.actionGroup}>
                                        {/* User actions */}
                                        {user.status === 'banned' ? (
                                            <>
                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                    Unban User
                                                </button>
                                                <button onClick={() => { handleDeleteUser(user.user_id); }} style={styles.deleteDangerBtn}>
                                                    Delete User
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {user.status !== 'suspended' && (
                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'suspended'); }} style={styles.suspendBtn}>
                                                        Suspend User
                                                    </button>
                                                )}
                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'banned'); }} style={styles.banBtn}>
                                                    Ban User
                                                </button>
                                                {user.status === 'suspended' && (
                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                        Reactivate User
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {/* Pharmacy actions */}
                                        {user.pharmacy_pharmacy_id && (
                                            <>
                                                {!user.pharmacy_verified && (
                                                    <button onClick={() => { handleVerifyPharmacy(user.pharmacy_pharmacy_id); }} style={styles.verifyBtn}>
                                                        Verify Pharmacy
                                                    </button>
                                                )}
                                                {user.pharmacy_status === 'banned' ? (
                                                    <>
                                                        <button onClick={() => { handlePharmacyStatusChange(user.pharmacy_pharmacy_id, 'active'); }} style={styles.reactivateBtn}>
                                                            Unban Pharmacy
                                                        </button>
                                                        <button onClick={() => { handleDeletePharmacy(user.pharmacy_pharmacy_id); }} style={styles.deleteDangerBtn}>
                                                            Delete Pharmacy
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {user.pharmacy_status !== 'suspended' && (
                                                            <button onClick={() => { handlePharmacyStatusChange(user.pharmacy_pharmacy_id, 'suspended'); }} style={styles.suspendBtn}>
                                                                Suspend Pharmacy
                                                            </button>
                                                        )}
                                                        <button onClick={() => { handlePharmacyStatusChange(user.pharmacy_pharmacy_id, 'banned'); }} style={styles.banBtn}>
                                                            Ban Pharmacy
                                                        </button>
                                                        {user.pharmacy_status === 'suspended' && (
                                                            <button onClick={() => { handlePharmacyStatusChange(user.pharmacy_pharmacy_id, 'active'); }} style={styles.reactivateBtn}>
                                                                Reactivate Pharmacy
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        // Doctor: Show with doctor verification options
                        if (user.role === 'Doctor') {
                            return (
                                <div key={user.user_id} style={styles.searchResultCard}>
                                    <table style={styles.searchTable}>
                                        <thead>
                                            <tr style={{ background: '#f8f9fa' }}>
                                                <th style={styles.th}>Name</th>
                                                <th style={styles.th}>Email</th>
                                                <th style={styles.th}>Phone</th>
                                                <th style={styles.th}>Verification</th>
                                                <th style={styles.th}>Status</th>
                                                <th style={styles.th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ background: user.status === 'banned' ? '#fff5f5' : user.status === 'suspended' ? '#fffbf0' : 'white' }}>
                                                <td style={styles.td}>{user.full_name}</td>
                                                <td style={styles.td}>{user.email}</td>
                                                <td style={styles.td}>{user.phone_number || 'N/A'}</td>
                                                <td style={styles.td}>{user.verified ? "✅ Verified" : "⏳ Pending"}</td>
                                                <td style={styles.td}>
                                                    <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                        {statusBadge.text}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    <div style={styles.actionGroup}>
                                                        {!user.verified && (
                                                            <button onClick={() => { handleVerifyDoctor(user.user_id); }} style={styles.verifyBtn}>
                                                                Verify
                                                            </button>
                                                        )}
                                                        {user.status === 'banned' ? (
                                                            <>
                                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                    Unban
                                                                </button>
                                                                <button onClick={() => { handleDeleteUser(user.user_id); }} style={styles.deleteDangerBtn}>
                                                                    Delete
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {user.status !== 'suspended' && (
                                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'suspended'); }} style={styles.suspendBtn}>
                                                                        Suspend
                                                                    </button>
                                                                )}
                                                                <button onClick={() => { handleUserStatusChange(user.user_id, 'banned'); }} style={styles.banBtn}>
                                                                    Ban
                                                                </button>
                                                                {user.status === 'suspended' && (
                                                                    <button onClick={() => { handleUserStatusChange(user.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                        Reactivate
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        }
                        // Other roles (Receptionist, Admin, etc.)
                        return (
                            <div key={user.user_id} style={styles.searchResultCard}>
                                <table style={styles.searchTable}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={styles.th}>Name</th>
                                            <th style={styles.th}>Email</th>
                                            <th style={styles.th}>Role</th>
                                            <th style={styles.th}>Status</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users
                                            .filter(u => u.role !== 'Admin')
                                            .map(u => {
                                                const statusBadge = getStatusBadge(u.status);
                                                return (
                                                    <tr key={u.user_id}> {/* Added unique key */}
                                                        <td style={styles.td}>{u.full_name}</td> {/* Changed 'user' to 'u' */}
                                                        <td style={styles.td}>{u.email}</td>     {/* Changed 'user' to 'u' */}
                                                        <td style={styles.td}>{u.role}</td>      {/* Changed 'user' to 'u' */}
                                                        <td style={styles.td}>
                                                            <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                                {statusBadge.text}
                                                            </span>
                                                        </td>
                                                        <td style={styles.td}>
                                                            <div style={styles.actionGroup}>
                                                                {u.status === 'banned' ? (
                                                                    <>
                                                                        <button onClick={() => { handleUserStatusChange(u.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                            Unban
                                                                        </button>
                                                                        <button onClick={() => { handleDeleteUser(u.user_id); }} style={styles.deleteDangerBtn}>
                                                                            Delete
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {u.status !== 'suspended' && (
                                                                            <button onClick={() => { handleUserStatusChange(u.user_id, 'suspended'); }} style={styles.suspendBtn}>
                                                                                Suspend
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => { handleUserStatusChange(u.user_id, 'banned'); }} style={styles.banBtn}>
                                                                            Ban
                                                                        </button>
                                                                        {u.status === 'suspended' && (
                                                                            <button onClick={() => { handleUserStatusChange(u.user_id, 'active'); }} style={styles.reactivateBtn}>
                                                                                Reactivate
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={styles.tabBar}>
                <button onClick={() => setActiveTab('pharmacies')} style={activeTab === 'pharmacies' ? styles.activeTab : styles.tab}>Pharmacy Verification</button>
                <button onClick={() => setActiveTab('doctors')} style={activeTab === 'doctors' ? styles.activeTab : styles.tab}>Doctor Verification</button>
                <button onClick={() => setActiveTab('users')} style={activeTab === 'users' ? styles.activeTab : styles.tab}>User Management</button>
                <button onClick={() => setActiveTab('feedback')} style={activeTab === 'feedback' ? styles.activeTab : styles.tab}>Feedback Moderation</button>
            </div>

            {loading ? <p>Loading system data...</p> : (
                <div style={styles.content}>
                    {searchResults.length > 0 && (
                        <div style={styles.searchNotice}>
                            <p>Showing search results. Use "Clear" to return to normal view.</p>
                        </div>
                    )}
                    {activeTab === 'pharmacies' && (
                        <>
                            {pharmacies.length === 0 ? (
                                <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    No pharmacies found. Pharmacies will appear here once pharmacists register.
                                </p>
                            ) : (
                                <table style={styles.table}>
                                    <thead>
                                        <tr><th>Name</th><th>Address</th><th>Contact</th><th>Verification</th><th>Status</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {pharmacies.map(p => {
                                            const statusBadge = getStatusBadge(p.status);
                                            return (
                                                <tr key={p.pharmacy_id} style={{ background: p.status === 'banned' ? '#fff5f5' : p.status === 'suspended' ? '#fffbf0' : 'white' }}>
                                                    <td style={styles.td}>{p.name}</td>
                                                    <td style={styles.td}>{p.address}</td>
                                                    <td style={styles.td}>{p.contact_number || 'N/A'}</td>
                                                    <td style={styles.td}>{p.verified ? "✅ Verified" : "⏳ Pending"}</td>
                                                    <td style={styles.td}>
                                                        <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                            {statusBadge.text}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={styles.actionGroup}>
                                                            {!p.verified && (
                                                                <button onClick={() => handleVerifyPharmacy(p.pharmacy_id)} style={styles.verifyBtn}>
                                                                    Verify
                                                                </button>
                                                            )}
                                                            {/* Ban means: not visible, and only Unban + Delete should be visible */}
                                                            {p.status === 'banned' ? (
                                                                <>
                                                                    <button onClick={() => handlePharmacyStatusChange(p.pharmacy_id, 'active')} style={styles.reactivateBtn}>
                                                                        Unban
                                                                    </button>
                                                                    <button onClick={() => handleDeletePharmacy(p.pharmacy_id)} style={styles.deleteDangerBtn}>
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {p.status !== 'suspended' && (
                                                                        <button onClick={() => handlePharmacyStatusChange(p.pharmacy_id, 'suspended')} style={styles.suspendBtn}>
                                                                            Suspend
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handlePharmacyStatusChange(p.pharmacy_id, 'banned')} style={styles.banBtn}>
                                                                        Ban
                                                                    </button>
                                                                    {p.status === 'suspended' && (
                                                                        <button onClick={() => handlePharmacyStatusChange(p.pharmacy_id, 'active')} style={styles.reactivateBtn}>
                                                                            Reactivate
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                    {activeTab === 'doctors' && (
                        <>
                            {users.length === 0 ? (
                                <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    No doctors found. Doctors will appear here once they register.
                                </p>
                            ) : (
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={styles.th}>Name</th>
                                            <th style={styles.th}>Email</th>
                                            <th style={styles.th}>Phone</th>
                                            <th style={styles.th}>Verification</th>
                                            <th style={styles.th}>Status</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => {
                                            const statusBadge = getStatusBadge(u.status);
                                            return (
                                                <tr key={u.user_id} style={{ background: u.status === 'banned' ? '#fff5f5' : u.status === 'suspended' ? '#fffbf0' : 'white' }}>
                                                    <td style={styles.td}>{u.full_name}</td>
                                                    <td style={styles.td}>{u.email}</td>
                                                    <td style={styles.td}>{u.phone_number || 'N/A'}</td>
                                                    <td style={styles.td}>{u.verified ? "✅ Verified" : "⏳ Pending"}</td>
                                                    <td style={styles.td}>
                                                        <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                            {statusBadge.text}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={styles.actionGroup}>
                                                            {!u.verified && (
                                                                <button onClick={() => handleVerifyDoctor(u.user_id)} style={styles.verifyBtn}>
                                                                    Verify
                                                                </button>
                                                            )}
                                                            {u.status === 'banned' ? (
                                                                <>
                                                                    <button onClick={() => handleUserStatusChange(u.user_id, 'active')} style={styles.reactivateBtn}>
                                                                        Unban
                                                                    </button>
                                                                    <button onClick={() => handleDeleteUser(u.user_id)} style={styles.deleteDangerBtn}>
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {u.status !== 'suspended' && (
                                                                        <button onClick={() => handleUserStatusChange(u.user_id, 'suspended')} style={styles.suspendBtn}>
                                                                            Suspend
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleUserStatusChange(u.user_id, 'banned')} style={styles.banBtn}>
                                                                        Ban
                                                                    </button>
                                                                    {u.status === 'suspended' && (
                                                                        <button onClick={() => handleUserStatusChange(u.user_id, 'active')} style={styles.reactivateBtn}>
                                                                            Reactivate
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                    {activeTab === 'users' && (
                        <table style={styles.table}>
                            <thead>
                                <tr style={{ background: '#f8f9fa' }}>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Email</th>
                                    <th style={styles.th}>Role</th>
                                    <th style={styles.th}>Verification</th>
                                    <th style={styles.th}>Status</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const statusBadge = getStatusBadge(u.status);
                                    return (
                                        <tr key={u.user_id} style={{ background: u.status === 'banned' ? '#fff5f5' : u.status === 'suspended' ? '#fffbf0' : 'white' }}>
                                            <td style={styles.td}>{u.full_name}</td>
                                            <td style={styles.td}>{u.email}</td>
                                            <td style={styles.td}>{u.role}</td>
                                            <td style={styles.td}>{u.verified ? "✅ Verified" : "⏳ Pending"}</td>
                                            <td style={styles.td}>
                                                <span style={{ color: statusBadge.color, fontWeight: 'bold' }}>
                                                    {statusBadge.text}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.actionGroup}>
                                                    {u.status === 'banned' ? (
                                                        <>
                                                            <button onClick={() => handleUserStatusChange(u.user_id, 'active')} style={styles.reactivateBtn}>
                                                                Unban
                                                            </button>
                                                            <button onClick={() => handleDeleteUser(u.user_id)} style={styles.deleteDangerBtn}>
                                                                Delete
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {u.status !== 'suspended' && (
                                                                <button onClick={() => handleUserStatusChange(u.user_id, 'suspended')} style={styles.suspendBtn}>
                                                                    Suspend
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleUserStatusChange(u.user_id, 'banned')} style={styles.banBtn}>
                                                                Ban
                                                            </button>
                                                            {u.status === 'suspended' && (
                                                                <button onClick={() => handleUserStatusChange(u.user_id, 'active')} style={styles.reactivateBtn}>
                                                                    Reactivate
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {activeTab === 'feedback' && (
                        <div style={styles.feedbackGrid}>
                            {feedback.map(f => (
                                <div key={f.feedback_id} style={styles.feedbackCard}>
                                    <p><strong>Rating:</strong> {f.rating}/5</p>
                                    <p>"{f.comment}"</p>
                                    <div style={styles.btnGroup}>
                                        <button onClick={() => handleModerateFeedback(f.feedback_id, 'Approved')} style={styles.approveBtn}>Approve</button>
                                        <button onClick={() => handleModerateFeedback(f.feedback_id, 'Removed')} style={styles.deleteBtn}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { padding: '20px' },
    searchSection: { marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' },
    searchForm: { display: 'flex', gap: '10px', alignItems: 'center' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem' },
    searchBtn: { padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
    clearBtn: { padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
    searchResultsSection: { marginBottom: '30px' },
    searchResultsTitle: { marginBottom: '15px', color: '#333' },
    searchResultCard: { background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    searchTable: { width: '100%', borderCollapse: 'collapse' },
    searchNotice: { background: '#e7f3ff', padding: '10px', borderRadius: '6px', marginBottom: '15px', color: '#004085' },
    resultHeader: { marginTop: 0, color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' },
    pharmacistInfo: { marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' },
    pharmacyInfoBox: { marginTop: '15px', padding: '15px', background: '#fffbf0', border: '1px solid #ffe58f', borderRadius: '6px' },
    pharmacyTitle: { marginTop: 0, color: '#856404' },
    tabBar: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ccc' },
    tab: { padding: '10px 20px', cursor: 'pointer', background: 'none', border: 'none' },
    activeTab: { padding: '10px 20px', cursor: 'pointer', borderBottom: '3px solid #007bff', fontWeight: 'bold' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    th: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' },
    td: { padding: '12px', borderBottom: '1px solid #dee2e6' },
    verifyBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginRight: '5px' },
    suspendBtn: { backgroundColor: '#ffc107', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginRight: '5px', fontWeight: 'bold' },
    banBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginRight: '5px' },
    reactivateBtn: { backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginRight: '5px' },
    deleteDangerBtn: { backgroundColor: '#343a40', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginRight: '5px' },
    actionGroup: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    feedbackGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    feedbackCard: { border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: '#f9f9f9' },
    btnGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
    approveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }
};

export default AdminDashboard;