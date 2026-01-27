import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

export default function DoctorDashboard() {
    const [medicines, setMedicines] = useState([]);
    const [prescription, setPrescription] = useState({
        patient_email: '',
        medicine_id: '',
        dosage: '',
        instructions: ''
    });
    const [verified, setVerified] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        // Check verification status
        if (user) {
            setVerified(user.verified);
        }

        // Reuse your existing medicines endpoint
        axios.get('https://medicine-finder-yej7.onrender.com/api/inventory/medicines')
            .then(res => setMedicines(res.data));
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!verified) {
            alert("Your account is pending verification. Please wait for admin approval before issuing prescriptions.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('https://medicine-finder-yej7.onrender.com/api/prescriptions/issue', {
                ...prescription
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            alert("Prescription issued successfully!");
            setPrescription({ patient_email: '', medicine_id: '', dosage: '', instructions: '' });
        } catch (err) {
            alert("Error: " + (err.response?.data?.error || "Failed to issue prescription"));
        }
    };

    if (verified === false) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
                        <h2 style={styles.title}>Account Pending Verification</h2>
                        <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
                            Your doctor account is pending admin verification. Once verified, you will be able to issue prescriptions to patients.
                        </p>
                        <p style={{ color: '#999', fontSize: '14px', marginTop: '20px' }}>
                            Please contact the administrator or wait for approval.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Doctor's Prescription Portal</h2>
            <div style={styles.card}>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <label>Patient Email</label>
                    <input
                        type="email"
                        required
                        value={prescription.patient_email}
                        onChange={(e) => setPrescription({ ...prescription, patient_email: e.target.value })}
                        style={styles.input}
                    />

                    <label>Medicine</label>
                    <select
                        required
                        value={prescription.medicine_id}
                        onChange={(e) => setPrescription({ ...prescription, medicine_id: e.target.value })}
                        style={styles.input}
                    >
                        <option value="">-- Select Medicine --</option>
                        {medicines.map(m => <option key={m.medicine_id} value={m.medicine_id}>{m.name}</option>)}
                    </select>

                    <label>Dosage (e.g., 500mg)</label>
                    <input
                        type="text"
                        value={prescription.dosage}
                        onChange={(e) => setPrescription({ ...prescription, dosage: e.target.value })}
                        style={styles.input}
                    />

                    <label>Instructions</label>
                    <textarea
                        rows="3"
                        value={prescription.instructions}
                        onChange={(e) => setPrescription({ ...prescription, instructions: e.target.value })}
                        style={styles.input}
                    />

                    <button type="submit" style={styles.button}>Issue Digital Prescription</button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container: { maxWidth: '600px', margin: '40px auto', padding: '20px' },
    title: { color: '#2c3e50', textAlign: 'center' },
    card: { background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    input: { padding: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem' },
    button: { background: '#007bff', color: 'white', padding: '14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
};
