import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { useAuth } from '../components/AuthContext';
import dotenv from 'dotenv';
dotenv.config();

const mapContainerStyle = {
    width: '100%',
    height: '450px',
    borderRadius: '12px',
    marginTop: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

const defaultCenter = { lat: 9.0122, lng: 38.7578 };

export default function MedicineSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedPharmacy, setSelectedPharmacy] = useState(null);
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [zoom, setZoom] = useState(12);
    const [pharmacyFeedback, setPharmacyFeedback] = useState({}); // Store feedback by pharmacy_id
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ pharmacy_id: null, rating: 5, comment: '' });
    const fetchedPharmacyIdsRef = useRef(new Set()); // Track which pharmacies we've fetched (using ref to avoid dependency issues)
    const { user } = useAuth();

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY
    });

    const location = useLocation();

    // Fetch approved feedback for a pharmacy
    const fetchPharmacyFeedback = async (pharmacyId) => {
        if (!pharmacyId) return;
        try {
            const res = await axios.get(`https://medicine-finder-yej7.onrender.com/api/feedback/${pharmacyId}`);
            setPharmacyFeedback(prev => ({ ...prev, [pharmacyId]: res.data }));
            fetchedPharmacyIdsRef.current.add(pharmacyId);
        } catch (err) {
            console.error("Failed to fetch feedback", err);
        }
    };

    // Fetch feedback for all pharmacies in results
    useEffect(() => {
        if (results.length > 0) {
            results.forEach(result => {
                if (result.pharmacy_id && !fetchedPharmacyIdsRef.current.has(result.pharmacy_id)) {
                    fetchPharmacyFeedback(result.pharmacy_id);
                }
            });
        }
    }, [results]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        try {
            const res = await axios.get(`https://medicine-finder-yej7.onrender.com/api/inventory/search?medName=${query}`);
            setResults(res.data);
            if (res.data.length > 0) {
                // Focus on first result immediately
                const first = res.data[0];
                setMapCenter({ lat: parseFloat(first.latitude), lng: parseFloat(first.longitude) });
                setZoom(13);
            }
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    // Handle feedback submission
    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!user || user.role !== 'Patient') {
            alert('Please login as a Patient to submit feedback');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('https://medicine-finder-yej7.onrender.com/api/feedback/submit', {
                pharmacy_id: feedbackForm.pharmacy_id,
                rating: feedbackForm.rating,
                comment: feedbackForm.comment
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            alert('Thank you! Your feedback has been submitted and is pending admin approval.');
            setShowFeedbackModal(false);
            setFeedbackForm({ pharmacy_id: null, rating: 5, comment: '' });
        } catch (err) {
            alert('Failed to submit feedback: ' + (err.response?.data?.error || 'Server error'));
        }
    };

    // Open feedback modal
    const openFeedbackModal = (pharmacyId, pharmacyName) => {
        if (!user || user.role !== 'Patient') {
            alert('Please login as a Patient to write a review');
            return;
        }
        setFeedbackForm({ pharmacy_id: pharmacyId, rating: 5, comment: '' });
        setShowFeedbackModal(true);
    };

    // Calculate average rating
    const getAverageRating = (pharmacyId) => {
        const feedback = pharmacyFeedback[pharmacyId] || [];
        if (feedback.length === 0) return null;
        const sum = feedback.reduce((acc, f) => acc + f.rating, 0);
        return (sum / feedback.length).toFixed(1);
    };

    // Helper to focus map on a specific pharmacy
    const focusOnPharmacy = (p) => {
        setSelectedPharmacy(p);
        setMapCenter({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) });
        setZoom(16); // Close-up zoom
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const medQuery = params.get('query');
        if (medQuery) {
            setQuery(medQuery);
            // Re-fetch logic for direct links from profile
            axios.get(`https://medicine-finder-yej7.onrender.com/api/inventory/search?medName=${medQuery}`)
                .then(res => {
                    setResults(res.data);
                    if (res.data.length > 0) {
                        focusOnPharmacy(res.data[0]);
                    }
                });
        }
    }, [location.search]);

    return (
        <div style={styles.container}>
            <div style={styles.searchHeader}>
                <h2>Find Medicine Nearby</h2>
                <form onSubmit={handleSearch} style={styles.searchBox}>
                    <input
                        type="text"
                        placeholder="Search medicine..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={styles.input}
                    />
                    <button type="submit" style={styles.button}>Search</button>
                </form>
            </div>

            <div style={styles.layout}>
                <div style={styles.resultsSide}>
                    {results.map((item, idx) => {
                        const avgRating = getAverageRating(item.pharmacy_id);
                        const feedback = pharmacyFeedback[item.pharmacy_id] || [];
                        return (
                            <div key={idx} style={styles.card}>
                                <div onClick={() => focusOnPharmacy(item)}>
                                    <strong>{item.pharmacy}</strong>
                                    <p>{item.address}</p>
                                    <span style={styles.stockLabel}>Stock: {item.quantity}</span>
                                    <p style={styles.priceLabel}>Price: ETB {item.price}</p>

                                    {/* Display Average Rating */}
                                    {avgRating && (
                                        <div style={styles.ratingSection}>
                                            <span style={styles.ratingText}>
                                                ⭐ {avgRating} ({feedback.length} {feedback.length === 1 ? 'review' : 'reviews'})
                                            </span>
                                        </div>
                                    )}

                                    {/* Display Recent Reviews */}
                                    {feedback.length > 0 && (
                                        <div style={styles.reviewsSection}>
                                            <strong style={styles.reviewsTitle}>Recent Reviews:</strong>
                                            {feedback.slice(0, 2).map((review, rIdx) => (
                                                <div key={rIdx} style={styles.reviewItem}>
                                                    <div style={styles.reviewHeader}>
                                                        <span style={styles.reviewName}>{review.full_name}</span>
                                                        <span style={styles.reviewRating}>⭐ {review.rating}/5</span>
                                                    </div>
                                                    <p style={styles.reviewComment}>"{review.comment}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Write Review Button for Patients */}
                                {user && user.role === 'Patient' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openFeedbackModal(item.pharmacy_id, item.pharmacy);
                                        }}
                                        style={styles.reviewBtn}
                                    >
                                        ✍️ Write Review
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={styles.mapSide}>
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={mapCenter}
                            zoom={zoom}
                        >
                            {results.map((p, idx) => (
                                <Marker
                                    key={idx}
                                    position={{ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }}
                                    onClick={() => focusOnPharmacy(p)}
                                />
                            ))}

                            {selectedPharmacy && (
                                <InfoWindow
                                    position={{ lat: parseFloat(selectedPharmacy.latitude), lng: parseFloat(selectedPharmacy.longitude) }}
                                    onCloseClick={() => setSelectedPharmacy(null)}
                                >
                                    <div style={{ color: '#333' }}>
                                        <h4>{selectedPharmacy.pharmacy}</h4>
                                        <p>Price: ETB {selectedPharmacy.price}</p>
                                        <button
                                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPharmacy.latitude},${selectedPharmacy.longitude}`)}
                                            style={styles.dirBtn}
                                        >
                                            Get Directions
                                        </button>
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    ) : <div>Loading Map...</div>}
                </div>
            </div>

            {/* Feedback Submission Modal */}
            {showFeedbackModal && (
                <div style={styles.modalOverlay} onClick={() => setShowFeedbackModal(false)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>Write a Review</h3>
                        <form onSubmit={handleSubmitFeedback}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Rating (1-5 stars)</label>
                                <select
                                    value={feedbackForm.rating}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: parseInt(e.target.value) })}
                                    style={styles.select}
                                    required
                                >
                                    <option value={5}>5 ⭐⭐⭐⭐⭐ (Excellent)</option>
                                    <option value={4}>4 ⭐⭐⭐⭐ (Very Good)</option>
                                    <option value={3}>3 ⭐⭐⭐ (Good)</option>
                                    <option value={2}>2 ⭐⭐ (Fair)</option>
                                    <option value={1}>1 ⭐ (Poor)</option>
                                </select>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Your Review</label>
                                <textarea
                                    value={feedbackForm.comment}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                                    style={styles.textarea}
                                    placeholder="Share your experience with this pharmacy..."
                                    rows="5"
                                    required
                                />
                            </div>

                            <div style={styles.modalButtons}>
                                <button type="button" onClick={() => setShowFeedbackModal(false)} style={styles.cancelBtn}>
                                    Cancel
                                </button>
                                <button type="submit" style={styles.submitBtn}>
                                    Submit Review
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
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
    searchBox: { display: 'flex', gap: '10px', marginBottom: '20px' },
    input: { flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc' },
    button: {
        padding: '12px 24px',
        background: '#0056b3',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'opacity 0.2s ease'
    },
    layout: { display: 'flex', gap: '20px' },
    resultsSide: { flex: 1, height: '450px', overflowY: 'auto' },
    mapSide: { flex: 2 },
    card: { padding: '15px', background: 'white', borderRadius: '8px', marginBottom: '10px', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    stockLabel: { color: '#28a745', fontWeight: 'bold', display: 'block', marginTop: '5px' },
    priceLabel: { color: '#0056b3', fontWeight: '600', display: 'block', marginTop: '5px' },
    ratingSection: { marginTop: '10px', padding: '8px', background: '#f8f9fa', borderRadius: '4px' },
    ratingText: { fontSize: '0.9rem', fontWeight: 'bold', color: '#ff9800' },
    reviewsSection: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' },
    reviewsTitle: { fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px' },
    reviewItem: { marginBottom: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '4px' },
    reviewHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' },
    reviewName: { fontSize: '0.8rem', fontWeight: 'bold', color: '#333' },
    reviewRating: { fontSize: '0.8rem', color: '#ff9800' },
    reviewComment: { fontSize: '0.75rem', color: '#555', fontStyle: 'italic', margin: 0 },
    reviewBtn: {
        width: '100%',
        marginTop: '10px',
        padding: '8px',
        background: '#ff9800',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.9rem'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    modalContent: {
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    },
    modalTitle: {
        marginTop: 0,
        marginBottom: '20px',
        color: '#333',
        textAlign: 'center'
    },
    formGroup: {
        marginBottom: '20px'
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        fontWeight: '600',
        color: '#333'
    },
    select: {
        width: '100%',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '1rem'
    },
    textarea: {
        width: '100%',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'vertical'
    },
    modalButtons: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        marginTop: '20px'
    },
    cancelBtn: {
        padding: '10px 20px',
        background: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    submitBtn: {
        padding: '10px 20px',
        background: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    dirBtn: { background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' }
};

// Add subtle hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    button:hover {
        opacity: 0.9 !important;
    }
    
    button:active {
        opacity: 0.95 !important;
    }
`;
if (!document.getElementById('medsearch-styles')) {
    styleSheet.id = 'medsearch-styles';
    document.head.appendChild(styleSheet);
}