import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

export default function InventoryManager() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [newItem, setNewItem] = useState({ medicine_id: '', quantity: '', price: '' });
    const [medicines, setMedicines] = useState([]);
    const [pharmacyFeedback, setPharmacyFeedback] = useState(null);
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'feedback', or 'patients'
    const [showAddMedicineModal, setShowAddMedicineModal] = useState(false);
    const [newMedicine, setNewMedicine] = useState({ name: '', description: '', category: '' });
    const [patientEmail, setPatientEmail] = useState('');
    const [patientData, setPatientData] = useState(null);
    const [searchError, setSearchError] = useState('');

    useEffect(() => {
        fetchInventory();
        fetchMedicines();
        fetchPharmacyFeedback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Helper function to handle authentication errors
    const handleAuthError = (err) => {
        if (err.response?.status === 401 || err.response?.status === 400) {
            // Token is invalid or expired
            const errorMsg = err.response?.data?.error || '';
            if (errorMsg.includes('token') || errorMsg.includes('Token') || errorMsg.includes('Access Denied')) {
                alert('Your session has expired. Please login again.');
                logout();
                navigate('/login');
                return true;
            }
        }
        return false;
    };

    const fetchInventory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/inventory/my-inventory', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInventory(res.data);
        } catch (err) {
            if (handleAuthError(err)) return;
            console.error("Failed to fetch inventory", err);
            if (err.response?.status === 404) {
                alert("Pharmacy not found. Please ensure your pharmacy is verified by admin.");
            }
        }
    };

    const fetchMedicines = async () => {
        try {
            const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/inventory/all-medicines');
            setMedicines(res.data);
        } catch (err) {
            console.error("Failed to fetch medicines");
        }
    };

    const fetchPharmacyFeedback = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('https://medicine-finder-yej7.onrender.com/api/pharmacist/feedback', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPharmacyFeedback(res.data);
        } catch (err) {
            if (handleAuthError(err)) return;
            console.error("Failed to fetch pharmacy feedback", err);
        }
    };

    const handleUpdateStock = async (e) => {
        e.preventDefault();
        if (!newItem.medicine_id) return alert("Please select a medicine");

        // Validate quantity
        const quantity = parseInt(newItem.quantity);
        if (isNaN(quantity) || newItem.quantity === '') {
            return alert("Please enter a valid quantity");
        }
        if (quantity < 0) {
            return alert("Quantity cannot be negative");
        }
        if (quantity > 999999) {
            return alert("Quantity cannot exceed 999,999 units");
        }

        // Validate price
        const price = parseFloat(newItem.price);
        if (isNaN(price) || newItem.price === '') {
            return alert("Please enter a valid price");
        }
        if (price < 0) {
            return alert("Price cannot be negative");
        }
        if (price === 0) {
            return alert("Price must be greater than zero");
        }
        if (price > 999999.99) {
            return alert("Price cannot exceed 999,999.99 ETB");
        }

        // Check decimal places
        const decimalPlaces = (price.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return alert("Price can have at most 2 decimal places");
        }

        try {
            const token = localStorage.getItem('token');
            const dataToSend = {
                medicine_id: newItem.medicine_id,
                quantity: quantity,
                price: Math.round(price * 100) / 100 // Round to 2 decimal places
            };

            await axios.post('https://medicine-finder-yej7.onrender.com/api/inventory/update', dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Inventory updated!");
            setNewItem({ medicine_id: '', quantity: '', price: '' });
            fetchInventory();
        } catch (err) {
            if (handleAuthError(err)) return;
            alert("Update failed: " + (err.response?.data?.error || 'Unknown error'));
        }
    };

    const handleAddNewMedicine = async (e) => {
        e.preventDefault();

        // Validate medicine name
        const medicineName = newMedicine.name.trim();
        if (!medicineName) {
            return alert("Medicine name is required");
        }
        if (medicineName.length < 2) {
            return alert("Medicine name must be at least 2 characters");
        }

        try {
            const token = localStorage.getItem('token');
            const medicineData = {
                name: medicineName,
                description: newMedicine.description.trim() || '',
                category: newMedicine.category.trim() || ''
            };

            await axios.post('https://medicine-finder-yej7.onrender.com/api/inventory/add-medicine', medicineData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Medicine added successfully!");
            setNewMedicine({ name: '', description: '', category: '' });
            setShowAddMedicineModal(false);
            fetchMedicines(); // Refresh the medicines list
        } catch (err) {
            if (handleAuthError(err)) return;
            alert("Failed to add medicine: " + (err.response?.data?.error || 'Unknown error'));
        }
    };

    const handleSearchPatient = async (e) => {
        e.preventDefault();
        setSearchError('');
        setPatientData(null);

        if (!patientEmail.trim()) {
            setSearchError('Please enter a patient email');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`https://medicine-finder-yej7.onrender.com/api/prescriptions/patient/${patientEmail}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPatientData(res.data);
        } catch (err) {
            if (handleAuthError(err)) return;
            setSearchError(err.response?.data?.error || 'Failed to find patient');
        }
    };

    const handleFulfillPrescription = async (prescriptionId) => {
        if (!window.confirm('Mark this prescription as fulfilled?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://medicine-finder-yej7.onrender.com/api/prescriptions/${prescriptionId}/fulfill`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Prescription marked as fulfilled!');
            // Refresh patient data
            handleSearchPatient({ preventDefault: () => { } });
        } catch (err) {
            if (handleAuthError(err)) return;
            alert('Failed to fulfill prescription: ' + (err.response?.data?.error || 'Unknown error'));
        }
    };

    // Helper function for status colors
    const getStatusStyle = (status) => ({
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        backgroundColor: status === 'In Stock' ? '#d4edda' : status === 'Low Stock' ? '#fff3cd' : '#f8d7da',
        color: status === 'In Stock' ? '#155724' : status === 'Low Stock' ? '#856404' : '#721c24'
    });

    // Helper function for tab styles
    const getTabStyle = (tabName) => {
        const isActive = activeTab === tabName;

        if (isActive) {
            return styles.activeTab;
        }

        return styles.tab;
    };

    // Render stars for rating
    const renderStars = (rating) => {
        return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    return (
        <div className="inventory-container" style={styles.container}>
            <h2 style={styles.header}>Pharmacy Dashboard</h2>

            {/* Suspension banner (pharmacist can still manage inventory, but pharmacy hidden from patient search) */}
            {pharmacyFeedback?.pharmacy?.status === 'suspended' && (
                <div style={styles.suspendedBanner}>
                    <strong>⚠️ Your pharmacy is suspended.</strong>
                    <div style={{ marginTop: '6px' }}>
                        You can still log in and update inventory, but your pharmacy will not appear in patient search results until an admin reactivates it.
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={styles.tabBar}>
                <button
                    className="pharmacy-tab-button"
                    onClick={() => setActiveTab('inventory')}
                    style={getTabStyle('inventory')}
                >
                    📦 Inventory Management
                </button>
                <button
                    className="pharmacy-tab-button"
                    onClick={() => setActiveTab('feedback')}
                    style={getTabStyle('feedback')}
                >
                    ⭐ Customer Reviews
                    {pharmacyFeedback && pharmacyFeedback.total_reviews > 0 && (
                        <span style={styles.badge}>{pharmacyFeedback.total_reviews}</span>
                    )}
                </button>
                <button
                    className="pharmacy-tab-button"
                    onClick={() => setActiveTab('patients')}
                    style={getTabStyle('patients')}
                >
                    🔍 Patient Lookup
                </button>
            </div>

            {/* Inventory Tab Content */}
            {activeTab === 'inventory' && (
                <>
                    {/* Add New Medicine Button - Only for verified pharmacies */}
                    {pharmacyFeedback?.pharmacy?.status !== 'suspended' && (
                        <div style={{ marginBottom: '20px', textAlign: 'right' }}>
                            <button
                                onClick={() => setShowAddMedicineModal(true)}
                                style={styles.addMedicineBtn}
                            >
                                ➕ Add New Medicine
                            </button>
                        </div>
                    )}

                    <div style={styles.card}>
                        <h3 style={styles.subHeader}>Update Stock Levels</h3>
                        <form onSubmit={handleUpdateStock} style={styles.formGrid}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Select Medicine</label>
                                <select
                                    value={newItem.medicine_id}
                                    onChange={(e) => setNewItem({ ...newItem, medicine_id: e.target.value })}
                                    style={styles.input}
                                >
                                    <option value="">-- Choose Medicine --</option>
                                    {medicines.map(m => <option key={m.medicine_id} value={m.medicine_id}>{m.name}</option>)}
                                </select>
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Quantity</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 50"
                                    value={newItem.quantity}
                                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                                    style={styles.input}
                                    min="0"
                                    max="999999"
                                    step="1"
                                    required
                                />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Price (ETB)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 12.50"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                    style={styles.input}
                                    min="0.01"
                                    max="999999.99"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <button type="submit" style={styles.submitBtn}>Update Inventory</button>
                            </div>
                        </form>
                    </div>

                    <div style={styles.card}>
                        <h3 style={styles.subHeader}>Current Inventory</h3>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeaderRow}>
                                    <th style={styles.th}>Medicine Name</th>
                                    <th style={styles.th}>Quantity</th>
                                    <th style={styles.th}>Unit Price</th>
                                    <th style={styles.th}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                            No inventory items yet. Add medicines to your inventory.
                                        </td>
                                    </tr>
                                ) : (
                                    inventory.map((item, index) => (
                                        <tr key={index} style={index % 2 === 0 ? styles.evenRow : {}}>
                                            <td style={styles.td}><strong>{item.medicine}</strong></td>
                                            <td style={styles.td}>{item.quantity} units</td>
                                            <td style={styles.td}>{item.price} ETB</td>
                                            <td style={styles.td}>
                                                <span style={getStatusStyle(item.status)}>{item.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Feedback Tab Content */}
            {activeTab === 'feedback' && (
                <div style={styles.card}>
                    {pharmacyFeedback ? (
                        <>
                            <div style={styles.pharmacyInfo}>
                                <h3 style={styles.subHeader}>{pharmacyFeedback.pharmacy.name}</h3>
                                <p style={styles.address}>{pharmacyFeedback.pharmacy.address}</p>

                                {pharmacyFeedback.average_rating && (
                                    <div style={styles.ratingSummary}>
                                        <div style={styles.ratingDisplay}>
                                            <span style={styles.ratingNumber}>{pharmacyFeedback.average_rating}</span>
                                            <span style={styles.ratingStars}>
                                                {renderStars(Math.round(parseFloat(pharmacyFeedback.average_rating)))}
                                            </span>
                                        </div>
                                        <p style={styles.reviewCount}>
                                            Based on {pharmacyFeedback.total_reviews} {pharmacyFeedback.total_reviews === 1 ? 'review' : 'reviews'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {pharmacyFeedback.feedback && pharmacyFeedback.feedback.length > 0 ? (
                                <div style={styles.feedbackList}>
                                    <h4 style={styles.feedbackTitle}>Customer Reviews</h4>
                                    {pharmacyFeedback.feedback.map((review) => (
                                        <div key={review.feedback_id} style={styles.feedbackCard}>
                                            <div style={styles.feedbackHeader}>
                                                <div>
                                                    <strong style={styles.reviewerName}>{review.patient_name}</strong>
                                                    <div style={styles.reviewRating}>
                                                        {renderStars(review.rating)} ({review.rating}/5)
                                                    </div>
                                                </div>
                                                <span style={styles.reviewDate}>
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p style={styles.reviewComment}>"{review.comment}"</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={styles.noFeedback}>
                                    <p>No reviews yet. Reviews will appear here once customers submit and they are approved by admin.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={styles.loading}>
                            <p>Loading feedback...</p>
                        </div>
                    )}
                </div>
            )}

            {/* Patient Lookup Tab Content */}
            {activeTab === 'patients' && (
                <div style={styles.card}>
                    <h3 style={styles.subHeader}>Patient Prescription Lookup</h3>

                    <form onSubmit={handleSearchPatient} style={{ marginBottom: '30px' }}>
                        <div style={styles.searchForm}>
                            <input
                                type="email"
                                placeholder="Enter patient email"
                                value={patientEmail}
                                onChange={(e) => setPatientEmail(e.target.value)}
                                style={styles.searchInput}
                            />
                            <button type="submit" style={styles.searchBtn}>Search</button>
                        </div>
                    </form>

                    {searchError && (
                        <div style={styles.errorMessage}>
                            ❌ {searchError}
                        </div>
                    )}

                    {patientData && (
                        <>
                            <div style={styles.patientInfo}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Patient Information</h4>
                                <p style={{ margin: '5px 0' }}><strong>Name:</strong> {patientData.patient.name}</p>
                                <p style={{ margin: '5px 0' }}><strong>Email:</strong> {patientData.patient.email}</p>
                                <p style={{ margin: '5px 0' }}><strong>Phone:</strong> {patientData.patient.phone || 'N/A'}</p>
                            </div>

                            <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#2c3e50' }}>Prescriptions</h4>

                            {patientData.prescriptions.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No prescriptions found for this patient.</p>
                            ) : (
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeaderRow}>
                                            <th style={styles.th}>Medicine</th>
                                            <th style={styles.th}>Dosage</th>
                                            <th style={styles.th}>Instructions</th>
                                            <th style={styles.th}>Doctor</th>
                                            <th style={styles.th}>Issued Date</th>
                                            <th style={styles.th}>Status</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patientData.prescriptions.map((prescription, index) => (
                                            <tr key={prescription.prescription_id} style={index % 2 === 0 ? styles.evenRow : {}}>
                                                <td style={styles.td}><strong>{prescription.medicine_name}</strong></td>
                                                <td style={styles.td}>{prescription.dosage || 'N/A'}</td>
                                                <td style={styles.td}>{prescription.instructions || 'N/A'}</td>
                                                <td style={styles.td}>{prescription.doctor_name || 'Unknown'}</td>
                                                <td style={styles.td}>{new Date(prescription.issued_at).toLocaleDateString()}</td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 'bold',
                                                        backgroundColor: prescription.status === 'Fulfilled' ? '#d4edda' : '#fff3cd',
                                                        color: prescription.status === 'Fulfilled' ? '#155724' : '#856404'
                                                    }}>
                                                        {prescription.status || 'Active'}
                                                    </span>
                                                </td>
                                                <td style={styles.td}>
                                                    {prescription.status !== 'Fulfilled' && (
                                                        <button
                                                            onClick={() => handleFulfillPrescription(prescription.prescription_id)}
                                                            style={styles.fulfillBtn}
                                                        >
                                                            ✓ Fulfill
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Add New Medicine Modal */}
            {showAddMedicineModal && (
                <div style={styles.modalOverlay} onClick={() => setShowAddMedicineModal(false)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalHeader}>Add New Medicine</h3>
                        <form onSubmit={handleAddNewMedicine} style={styles.modalForm}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Medicine Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Aspirin"
                                    value={newMedicine.name}
                                    onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Description (Optional)</label>
                                <textarea
                                    rows="3"
                                    placeholder="Brief description of the medicine"
                                    value={newMedicine.description}
                                    onChange={(e) => setNewMedicine({ ...newMedicine, description: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Category (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Antibiotic, Painkiller"
                                    value={newMedicine.category}
                                    onChange={(e) => setNewMedicine({ ...newMedicine, category: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.modalButtons}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddMedicineModal(false);
                                        setNewMedicine({ name: '', description: '', category: '' });
                                    }}
                                    style={styles.cancelBtn}
                                >
                                    Cancel
                                </button>
                                <button type="submit" style={styles.submitBtn}>
                                    Add Medicine
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { maxWidth: '900px', margin: '0 auto', padding: '20px' },
    header: { color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' },
    suspendedBanner: {
        background: '#fffbf0',
        border: '1px solid #ffe58f',
        color: '#7a5b00',
        padding: '14px',
        borderRadius: '10px',
        margin: '18px 0'
    },
    subHeader: { marginTop: 0, fontSize: '1.1rem', color: '#555' },
    card: { background: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '30px', minHeight: '400px' },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    inputGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '5px', fontWeight: '600', fontSize: '0.9rem', color: '#666' },
    input: { padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' },
    submitBtn: { width: '100%', background: '#3498db', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    table: { width: '100%', borderCollapse: 'collapse' },
    tableHeaderRow: { backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' },
    th: { textAlign: 'left', padding: '12px', color: '#495057' },
    td: { padding: '12px', borderBottom: '1px solid #eee' },
    evenRow: { backgroundColor: '#fafafa' },
    tabBar: {
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '10px'
    },
    tab: {
        padding: '12px 24px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#666',
        borderBottom: '3px solid transparent',
        position: 'relative',
        transition: 'all 0.3s ease',
        borderRadius: '8px 8px 0 0'
    },
    activeTab: {
        padding: '12px 24px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: '#3498db',
        borderBottom: '3px solid #3498db',
        transition: 'all 0.3s ease',
        borderRadius: '8px 8px 0 0'
    },
    badge: {
        marginLeft: '8px',
        background: '#3498db',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 'bold'
    },
    pharmacyInfo: {
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e0e0e0'
    },
    address: {
        color: '#666',
        fontSize: '0.9rem',
        marginTop: '5px'
    },
    ratingSummary: {
        marginTop: '15px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px'
    },
    ratingDisplay: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '5px'
    },
    ratingNumber: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#ff9800'
    },
    ratingStars: {
        fontSize: '1.2rem'
    },
    reviewCount: {
        color: '#666',
        fontSize: '0.9rem',
        margin: 0
    },
    feedbackList: {
        marginTop: '20px'
    },
    feedbackTitle: {
        color: '#2c3e50',
        marginBottom: '15px',
        fontSize: '1.2rem'
    },
    feedbackCard: {
        background: '#f9f9f9',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '15px',
        border: '1px solid #e0e0e0'
    },
    feedbackHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '10px'
    },
    reviewerName: {
        color: '#2c3e50',
        fontSize: '1rem',
        display: 'block',
        marginBottom: '5px'
    },
    reviewRating: {
        color: '#ff9800',
        fontSize: '0.9rem'
    },
    reviewDate: {
        color: '#999',
        fontSize: '0.85rem',
        fontStyle: 'italic'
    },
    reviewComment: {
        color: '#555',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        margin: 0,
        fontStyle: 'italic'
    },
    noFeedback: {
        textAlign: 'center',
        padding: '40px',
        color: '#999'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#666'
    },
    addMedicineBtn: {
        background: '#27ae60',
        color: 'white',
        padding: '10px 20px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.95rem',
        transition: 'background 0.3s'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    modalContent: {
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto'
    },
    modalHeader: {
        marginTop: 0,
        marginBottom: '20px',
        color: '#2c3e50',
        fontSize: '1.4rem'
    },
    modalForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    modalButtons: {
        display: 'flex',
        gap: '10px',
        marginTop: '10px'
    },
    cancelBtn: {
        flex: 1,
        background: '#95a5a6',
        color: 'white',
        padding: '12px',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    searchForm: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
    },
    searchInput: {
        flex: 1,
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '1rem'
    },
    searchBtn: {
        background: '#3498db',
        color: 'white',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1rem'
    },
    patientInfo: {
        background: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #dee2e6'
    },
    errorMessage: {
        background: '#f8d7da',
        color: '#721c24',
        padding: '12px',
        borderRadius: '6px',
        marginBottom: '20px',
        border: '1px solid #f5c6cb'
    },
    fulfillBtn: {
        background: '#28a745',
        color: 'white',
        padding: '6px 12px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.85rem'
    }
};

// Add CSS to prevent hover effects on tab buttons
const tabStyleSheet = document.createElement('style');
tabStyleSheet.textContent = `
    .pharmacy-tab-button:hover {
        background: transparent !important;
        color: inherit !important;
        transform: none !important;
        box-shadow: none !important;
    }
`;
if (!document.querySelector('style[data-pharmacy-tabs]')) {
    tabStyleSheet.setAttribute('data-pharmacy-tabs', 'true');
    document.head.appendChild(tabStyleSheet);
}