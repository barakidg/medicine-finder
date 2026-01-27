import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function PatientProfile() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Added loading state management
    const navigate = useNavigate();

    useEffect(() => {
        const loggedInUser = JSON.parse(localStorage.getItem('user'));
        if (!loggedInUser) {
            navigate('/login');
        } else {
            setUser(loggedInUser);
            if (loggedInUser.email) {
                fetchPrescriptions(loggedInUser.email);
            } else {
                setLoading(false);
            }
        }
    }, [navigate]);

    const fetchPrescriptions = async (email) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/prescriptions/my-prescriptions/${email}`);
            setPrescriptions(res.data);
        } catch (err) {
            console.error("Error fetching prescriptions", err);
        } finally {
            setLoading(false); // Stop loading regardless of success or failure
        }
    };

    const handleFindMedicine = (medicineName) => {
        navigate(`/?query=${medicineName}`);
    };

    const handleCancelPrescription = async (prescriptionId) => {
        if (!window.confirm('Are you sure you want to cancel this prescription?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/prescriptions/${prescriptionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Prescription cancelled successfully');
            // Refresh prescriptions
            if (user?.email) {
                fetchPrescriptions(user.email);
            }
        } catch (err) {
            alert('Failed to cancel prescription: ' + (err.response?.data?.error || 'Unknown error'));
        }
    };

    const handleFulfillPrescription = async (prescriptionId) => {
        if (!window.confirm('Mark this prescription as fulfilled?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/prescriptions/${prescriptionId}/fulfill`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Prescription marked as fulfilled!');
            // Refresh prescriptions
            if (user?.email) {
                fetchPrescriptions(user.email);
            }
        } catch (err) {
            alert('Failed to fulfill prescription: ' + (err.response?.data?.error || 'Unknown error'));
        }
    };

    if (loading) {
        return <div style={{ padding: '50px', textAlign: 'center' }}>Loading your medical records...</div>;
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2>Welcome, {user?.name}</h2>
                <p style={{ color: '#666' }}>Your Medical Records & Prescriptions</p>
            </div>

            <div style={styles.section}>
                <h3>Your Active Prescriptions</h3>
                {prescriptions.length === 0 ? (
                    <p>No prescriptions found for {user?.email}.</p>
                ) : (
                    <div style={styles.grid}>
                        {prescriptions.map((p) => (
                            <div key={p.prescription_id} style={styles.card}>
                                <button
                                    onClick={() => handleCancelPrescription(p.prescription_id)}
                                    style={styles.cancelBtn}
                                    title="Cancel prescription"
                                >
                                    ✕
                                </button>
                                <div style={styles.statusBadge}>{p.status || 'Active'}</div>
                                <h4 style={{ margin: '10px 0' }}>{p.medicine_name}</h4>
                                <p><strong>Dosage:</strong> {p.dosage}</p>
                                <p><strong>Instructions:</strong> {p.instructions}</p>
                                <p style={{ fontSize: '0.8rem', color: '#888' }}>
                                    Issued: {new Date(p.issued_at).toLocaleDateString()}
                                </p>
                                <div style={styles.buttonGroup}>
                                    <button
                                        onClick={() => handleFindMedicine(p.medicine_name)}
                                        style={styles.searchBtn}
                                    >
                                        🔍 Find Nearby
                                    </button>
                                    {p.status !== 'Fulfilled' && (
                                        <button
                                            onClick={() => handleFulfillPrescription(p.prescription_id)}
                                            style={styles.fulfillBtn}
                                        >
                                            ✓ Mark Fulfilled
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
    header: { marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '10px' },
    section: { background: '#fff', padding: '20px', borderRadius: '12px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
    card: { border: '1px solid #eee', padding: '20px', borderRadius: '12px', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', paddingTop: '45px' },
    statusBadge: { position: 'absolute', top: '10px', left: '10px', background: '#e3f2fd', color: '#1976d2', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' },
    searchBtn: { flex: 1, padding: '10px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { position: 'absolute', top: '10px', right: '10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 10 },
    fulfillBtn: { flex: 1, padding: '10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
    buttonGroup: { display: 'flex', gap: '10px', marginTop: '15px' }
};