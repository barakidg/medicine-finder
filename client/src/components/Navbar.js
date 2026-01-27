import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav style={styles.nav}>
            <div style={styles.logo}>
                <Link to="/" style={styles.link}>MedFinder</Link>
            </div>
            <div style={styles.links}>
                {!user ? (
                    <>
                        <Link to="/login" style={styles.link}>Login</Link>
                        <Link to="/register" style={styles.link}>Register</Link>
                    </>
                ) : (
                    <>
                        {/* Role-Based Links */}
                        {user.role === 'Patient' && (
                            <Link to="/patient" style={styles.link}>My Prescriptions</Link>
                        )}

                        <span style={styles.user}>Hi, {user.name}</span>
                        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
                    </>
                )}
            </div>
        </nav>
    );
};

const styles = {
    nav: { display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', background: '#0056b3', color: 'white', alignItems: 'center' },
    logo: { fontSize: '1.5rem', fontWeight: 'bold' },
    links: { display: 'flex', gap: '15px', alignItems: 'center' },
    link: { color: 'white', textDecoration: 'none', fontWeight: '500' },
    user: { marginRight: '10px', fontStyle: 'italic', fontSize: '0.9rem' },
    logoutBtn: { background: '#f44336', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer' }
};

export default Navbar;