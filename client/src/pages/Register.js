import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '10px'
};

const modalMapStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '10px'
};

const Register = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '', email: '', password: '', role: 'Patient', phone: ''
    });
    const [pharmacyData, setPharmacyData] = useState({
        pharmacyName: '', pharmacyAddress: '', contactNumber: ''
    });
    const [locationPreview, setLocationPreview] = useState(null); // { lat, lng }
    const [showMapModal, setShowMapModal] = useState(false);
    const [tempLocation, setTempLocation] = useState({ lat: 9.0122, lng: 38.7578 }); // Default to Addis Ababa
    const navigate = useNavigate();

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY
    });

    const handleOpenMapModal = () => {
        setShowMapModal(true);
        if (locationPreview) {
            setTempLocation({ lat: locationPreview.lat, lng: locationPreview.lng });
        }
    };

    const handleMapClick = (event) => {
        setTempLocation({
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        });
    };

    const handleConfirmLocation = () => {
        setLocationPreview(tempLocation);
        setShowMapModal(false);
    };

    const handleUserSubmit = async (e) => {
        e.preventDefault();

        // Validation helper functions
        const validateEmail = (email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        // Password validation removed - accept any password

        const validateEthiopianPhone = (phone) => {
            if (!phone) return true; // Phone is optional
            const phoneRegex = /^(\+251|0)[0-9]{9}$/;
            return phoneRegex.test(phone.replace(/\s/g, ''));
        };

        // Trim inputs
        const trimmedName = formData.fullName.trim();
        const trimmedEmail = formData.email.trim().toLowerCase();
        const trimmedPhone = formData.phone.trim();

        // Validate full name
        if (!trimmedName) {
            return alert("Full name is required");
        }
        if (trimmedName.length < 2) {
            return alert("Full name must be at least 2 characters");
        }

        // Validate email
        if (!trimmedEmail) {
            return alert("Email is required");
        }
        if (!validateEmail(trimmedEmail)) {
            return alert("Please enter a valid email address");
        }

        // Validate password
        if (!formData.password) {
            return alert("Password is required");
        }

        // Validate phone number
        if (trimmedPhone && !validateEthiopianPhone(trimmedPhone)) {
            return alert("Invalid phone number format. Use Ethiopian format: +251XXXXXXXXX or 0XXXXXXXXX");
        }

        // Update formData with trimmed values
        const cleanedFormData = {
            ...formData,
            fullName: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone || ''
        };

        if (formData.role !== 'Pharmacist') {
            setLoading(true);
            try {
                await axios.post('https://medicine-finder-yej7.onrender.com/api/auth/register', cleanedFormData);
                alert("Registration successful! Please login.");
                navigate('/login');
            } catch (err) {
                alert("Error: " + (err.response?.data?.error || 'Registration failed'));
            } finally {
                setLoading(false);
            }
        } else {
            setStep(2);
        }
    };

    const handlePharmacySubmit = async (e) => {
        e.preventDefault();

        if (!locationPreview) {
            alert("Please select your pharmacy location on the map");
            return;
        }

        // Validate pharmacy details
        const validateEthiopianPhone = (phone) => {
            if (!phone) return true; // Phone is optional
            const phoneRegex = /^(\+251|0)[0-9]{9}$/;
            return phoneRegex.test(phone.replace(/\s/g, ''));
        };

        const trimmedPharmacyName = pharmacyData.pharmacyName.trim();
        const trimmedPharmacyAddress = pharmacyData.pharmacyAddress.trim();
        const trimmedContactNumber = pharmacyData.contactNumber.trim();

        if (!trimmedPharmacyName) {
            return alert("Pharmacy name is required");
        }

        if (!trimmedPharmacyAddress) {
            return alert("Pharmacy address is required");
        }

        if (trimmedContactNumber && !validateEthiopianPhone(trimmedContactNumber)) {
            return alert("Invalid contact number format. Use Ethiopian format: +251XXXXXXXXX or 0XXXXXXXXX");
        }

        setLoading(true);
        try {
            const response = await axios.post('https://medicine-finder-yej7.onrender.com/api/auth/register', {
                ...formData,
                pharmacyDetails: {
                    pharmacyName: trimmedPharmacyName,
                    pharmacyAddress: trimmedPharmacyAddress,
                    contactNumber: trimmedContactNumber || '',
                    latitude: locationPreview.lat,
                    longitude: locationPreview.lng
                }
            });
            alert(response.data.message || "Registration successful! Your pharmacy is pending admin verification. Please login.");
            navigate('/login');
        } catch (err) {
            alert("Error: " + (err.response?.data?.error || 'Registration failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.logo}>{step === 1 ? '👤' : '🏥'}</div>
                    <h1 style={styles.title}>
                        {step === 1 ? 'Create Account' : 'Pharmacy Information'}
                    </h1>
                    <p style={styles.subtitle}>
                        {step === 1
                            ? 'Join Medicine Finder and get started'
                            : 'Complete your pharmacy registration'}
                    </p>
                    {step === 2 && (
                        <div style={styles.progressBar}>
                            <div style={styles.progressFill}></div>
                        </div>
                    )}
                </div>

                {step === 1 ? (
                    <form onSubmit={handleUserSubmit} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Full Name</label>
                            <input
                                type="text"
                                placeholder="Enter your full name"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                style={styles.input}
                                required
                                minLength="2"
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Email Address</label>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Password</label>
                            <input
                                type="password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Phone Number</label>
                            <input
                                type="text"
                                placeholder="Enter your phone number"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Select Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                style={styles.select}
                            >
                                <option value="Patient">👤 Patient</option>
                                <option value="Doctor">👨‍⚕️ Doctor</option>
                                <option value="Pharmacist">💊 Pharmacist</option>
                                <option value="Receptionist">📋 Receptionist</option>
                            </select>
                        </div>

                        <button type="submit" style={styles.button} disabled={loading}>
                            {loading ? 'Creating Account...' : formData.role === 'Pharmacist' ? 'Continue to Pharmacy Details' : 'Create Account'}
                        </button>

                        <div style={styles.footer}>
                            <p style={styles.footerText}>
                                Already have an account?{' '}
                                <Link to="/login" style={styles.link}>
                                    Sign In
                                </Link>
                            </p>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handlePharmacySubmit} style={styles.form}>
                        <div style={styles.infoBox}>
                            <p style={styles.infoText}>
                                📋 Please provide your pharmacy details. Your pharmacy will be verified by admin before activation.
                            </p>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Pharmacy Name *</label>
                            <input
                                type="text"
                                placeholder="Enter pharmacy name"
                                value={pharmacyData.pharmacyName}
                                onChange={(e) => setPharmacyData({ ...pharmacyData, pharmacyName: e.target.value })}
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Pharmacy Address *</label>
                            <textarea
                                placeholder="Enter full address (e.g., '6 Kilo, Addis Ababa, Ethiopia')"
                                value={pharmacyData.pharmacyAddress}
                                onChange={(e) => setPharmacyData({ ...pharmacyData, pharmacyAddress: e.target.value })}
                                rows="3"
                                style={styles.textarea}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Pharmacy Location * (Click on map to select)</label>
                            <button
                                type="button"
                                onClick={handleOpenMapModal}
                                style={styles.mapButton}
                            >
                                {locationPreview ? '📍 Location Selected - Click to Change' : '🗺️ Select Location on Map'}
                            </button>
                        </div>

                        {locationPreview && isLoaded && (
                            <div style={styles.mapPreview}>
                                <div style={styles.mapHeader}>
                                    <strong>✓ Selected Location:</strong>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#666' }}>
                                        Lat: {locationPreview.lat.toFixed(6)}, Lng: {locationPreview.lng.toFixed(6)}
                                    </p>
                                </div>
                                <GoogleMap
                                    mapContainerStyle={mapContainerStyle}
                                    center={{ lat: locationPreview.lat, lng: locationPreview.lng }}
                                    zoom={15}
                                >
                                    <Marker position={{ lat: locationPreview.lat, lng: locationPreview.lng }} />
                                </GoogleMap>
                            </div>
                        )}

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Contact Number</label>
                            <input
                                type="text"
                                placeholder="Enter contact number"
                                value={pharmacyData.contactNumber}
                                onChange={(e) => setPharmacyData({ ...pharmacyData, contactNumber: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.buttonRow}>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                style={styles.backButton}
                            >
                                ← Back
                            </button>
                            <button
                                type="submit"
                                style={styles.button}
                                disabled={loading}
                            >
                                {loading ? 'Registering...' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Map Selection Modal */}
            {showMapModal && isLoaded && (
                <div style={styles.modalOverlay} onClick={() => setShowMapModal(false)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h2 style={styles.modalTitle}>Select Your Pharmacy Location</h2>
                        <p style={styles.modalSubtitle}>Click anywhere on the map to set your pharmacy's exact location</p>

                        <GoogleMap
                            mapContainerStyle={modalMapStyle}
                            center={tempLocation}
                            zoom={13}
                            onClick={handleMapClick}
                        >
                            <Marker position={tempLocation} />
                        </GoogleMap>

                        <div style={styles.modalInfo}>
                            <p style={{ margin: '10px 0', fontSize: '14px' }}>
                                <strong>Selected:</strong> Lat: {tempLocation.lat.toFixed(6)}, Lng: {tempLocation.lng.toFixed(6)}
                            </p>
                        </div>

                        <div style={styles.modalButtons}>
                            <button
                                onClick={() => setShowMapModal(false)}
                                style={styles.cancelButton}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmLocation}
                                style={styles.confirmButton}
                            >
                                ✓ Confirm Location
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'white',
        padding: '20px'
    },
    card: {
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '650px',
        animation: 'slideUp 0.5s ease-out',
        border: '1px solid #e2e8f0'
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    logo: {
        fontSize: '60px',
        marginBottom: '10px'
    },
    title: {
        margin: '0 0 10px 0',
        color: '#2d3748',
        fontSize: '28px',
        fontWeight: '700'
    },
    subtitle: {
        margin: '0',
        color: '#718096',
        fontSize: '14px'
    },
    progressBar: {
        width: '100%',
        height: '4px',
        background: '#e2e8f0',
        borderRadius: '2px',
        marginTop: '15px',
        overflow: 'hidden'
    },
    progressFill: {
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        animation: 'progress 0.5s ease-out'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    infoBox: {
        background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)',
        padding: '15px',
        borderRadius: '10px',
        border: '1px solid #c7d2fe'
    },
    infoText: {
        margin: '0',
        color: '#5b21b6',
        fontSize: '14px',
        lineHeight: '1.5'
    },
    mapPreview: {
        background: '#f0fdf4',
        padding: '15px',
        borderRadius: '10px',
        border: '2px solid #86efac'
    },
    mapHeader: {
        marginBottom: '10px',
        color: '#166534'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    label: {
        color: '#2d3748',
        fontSize: '14px',
        fontWeight: '600'
    },
    input: {
        padding: '14px 16px',
        border: '2px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '16px',
        transition: 'all 0.3s ease',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: 'inherit'
    },
    textarea: {
        padding: '14px 16px',
        border: '2px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '16px',
        transition: 'all 0.3s ease',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: 'inherit',
        resize: 'vertical'
    },
    select: {
        padding: '14px 16px',
        border: '2px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '16px',
        transition: 'all 0.3s ease',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
        background: 'white',
        cursor: 'pointer',
        fontFamily: 'inherit'
    },
    mapButton: {
        padding: '14px 16px',
        background: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    button: {
        padding: '14px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
        flex: 1
    },
    backButton: {
        padding: '14px 20px',
        background: '#e2e8f0',
        color: '#4a5568',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    buttonRow: {
        display: 'flex',
        gap: '15px',
        marginTop: '10px'
    },
    footer: {
        textAlign: 'center',
        marginTop: '20px'
    },
    footerText: {
        color: '#718096',
        fontSize: '14px',
        margin: '0'
    },
    link: {
        color: '#667eea',
        textDecoration: 'none',
        fontWeight: '600',
        transition: 'color 0.3s ease'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
    },
    modalContent: {
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
    },
    modalTitle: {
        margin: '0 0 10px 0',
        color: '#2d3748',
        fontSize: '24px',
        fontWeight: '700'
    },
    modalSubtitle: {
        margin: '0 0 20px 0',
        color: '#718096',
        fontSize: '14px'
    },
    modalInfo: {
        background: '#f7fafc',
        padding: '10px 15px',
        borderRadius: '8px',
        marginTop: '15px'
    },
    modalButtons: {
        display: 'flex',
        gap: '15px',
        marginTop: '20px'
    },
    cancelButton: {
        flex: 1,
        padding: '12px',
        background: '#e2e8f0',
        color: '#4a5568',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    confirmButton: {
        flex: 1,
        padding: '12px',
        background: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
    }
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes progress {
        from {
            width: 0%;
        }
        to {
            width: 100%;
        }
    }
    
    input:focus, textarea:focus, select:focus {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
    }
    
    button:hover:not(:disabled) {
        opacity: 0.9;
    }
    
    button:active:not(:disabled) {
        opacity: 0.95;
    }
    
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    a:hover {
        color: #764ba2 !important;
    }
`;
if (!document.getElementById('register-styles')) {
    styleSheet.id = 'register-styles';
    document.head.appendChild(styleSheet);
}

export default Register;
