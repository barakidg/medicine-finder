import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const Register = () => {
    const [step, setStep] = useState(1); // 1: User info, 2: Pharmacy info (for pharmacists)
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '', email: '', password: '', role: 'Patient', phone: ''
    });
    const [pharmacyData, setPharmacyData] = useState({
        pharmacyName: '', pharmacyAddress: '', contactNumber: ''
    });
    const [locationPreview, setLocationPreview] = useState(null); // { lat, lng, address }
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState('');
    const navigate = useNavigate();

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyDVFoAFy4LSfELZ3C2Izd43zO1ac5AXSOY"
    });

    const handleUserSubmit = async (e) => {
        e.preventDefault();

        // If not pharmacist, register directly
        if (formData.role !== 'Pharmacist') {
            setLoading(true);
            try {
                await axios.post('https://medicine-finder-yej7.onrender.com/api/auth/register', formData);
                alert("Registration successful! Please login.");
                navigate('/login');
            } catch (err) {
                alert("Error: " + (err.response?.data?.error || 'Registration failed'));
            } finally {
                setLoading(false);
            }
        } else {
            // If pharmacist, move to pharmacy details step
            setStep(2);
        }
    };

    const handlePharmacySubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post('https://medicine-finder-yej7.onrender.com/api/auth/register', {
                ...formData,
                pharmacyDetails: pharmacyData
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
                                placeholder="Enter full address"
                                value={pharmacyData.pharmacyAddress}
                                onChange={(e) => setPharmacyData({ ...pharmacyData, pharmacyAddress: e.target.value })}
                                rows="3"
                                style={styles.textarea}
                                required
                            />
                        </div>

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

                        <div style={styles.infoBox}>
                            <p style={styles.infoText}>
                                📍 Your pharmacy location will be automatically determined from the address you provide.
                            </p>
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
        maxWidth: '550px',
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
    row: {
        display: 'flex',
        gap: '15px'
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
        box-shadow: 0 4px 18px rgba(102, 126, 234, 0.4) !important;
    }
    
    button:active:not(:disabled) {
        opacity: 0.95;
    }
    
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .backButton:hover {
        background: #cbd5e0 !important;
        opacity: 0.9;
    }
    
    a:hover {
        color: #764ba2 !important;
    }
`;
document.head.appendChild(styleSheet);

export default Register;