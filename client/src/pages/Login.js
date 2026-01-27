import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail) {
            return alert("Email is required");
        }

        if (!emailRegex.test(trimmedEmail)) {
            return alert("Please enter a valid email address");
        }

        if (!trimmedPassword) {
            return alert("Password is required");
        }

        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', {
                email: trimmedEmail,
                password: trimmedPassword
            });
            login(res.data);

            const role = res.data.user.role;

            // ROLE-BASED REDIRECTION
            if (role === 'Admin') {
                navigate('/admin');
            } else if (role === 'Doctor') {
                // Check if doctor is verified
                if (!res.data.user.verified) {
                    alert('Your account is pending verification. Please wait for admin approval.');
                    navigate('/'); // Redirect to home until verified
                } else {
                    navigate('/doctor-dashboard');
                }
            } else if (role === 'Pharmacist') {
                navigate('/inventory');
            } else if (role === 'Receptionist') {
                navigate('/receptionist');
            } else {
                navigate('/'); // Default for Patients
            }
        } catch (err) {
            alert("Login failed: " + (err.response?.data?.error || "Server error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.logo}>💊</div>
                    <h1 style={styles.title}>Welcome Back</h1>
                    <p style={styles.subtitle}>Sign in to your Medicine Finder account</p>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            required
                        />
                    </div>

                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div style={styles.footer}>
                        <p style={styles.footerText}>
                            Don't have an account?{' '}
                            <Link to="/register" style={styles.link}>
                                Create Account
                            </Link>
                        </p>
                    </div>
                </form>
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
        maxWidth: '450px',
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
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
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
        width: '100%'
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
        marginTop: '10px',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
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

// Add CSS animation
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
    
    input:focus {
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
    
    a:hover {
        color: #764ba2 !important;
    }
`;
document.head.appendChild(styleSheet);

export default Login;