import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function ReceptionistPanel() {
    const [email, setEmail] = useState('');
    const [data, setData] = useState(null);
    const [selectedPrescription, setSelectedPrescription] = useState(null);
    const [recentPrescriptions, setRecentPrescriptions] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const componentRef = useRef();

    useEffect(() => {
        fetchRecentPrescriptions();
    }, []);

    const fetchRecentPrescriptions = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/reception/recent-prescriptions?limit=30', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecentPrescriptions(res.data);
        } catch (err) {
            console.error("Failed to fetch recent prescriptions", err);
        } finally {
            setLoadingRecent(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/reception/patient-records/${email}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
            setSelectedPrescription(null);
            // Refresh recent prescriptions after search
            fetchRecentPrescriptions();
        } catch (err) {
            if (err.response?.status === 404) {
                alert("Patient not found.");
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                alert("Access denied. Please login as a Receptionist.");
            } else {
                alert("Error: " + (err.response?.data?.error || err.message));
            }
        }
    };

    const handlePrint = () => {
        if (!selectedPrescription) {
            alert('No prescription selected for printing.');
            return;
        }

        // Direct print using window.open and window.print
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to print');
            return;
        }

        const patientName = data?.full_name || selectedPrescription.patient_name || selectedPrescription.patient_email || 'N/A';
        const patientEmail = data?.email || selectedPrescription.patient_email || 'N/A';
        const issueDate = selectedPrescription.issued_at
            ? new Date(selectedPrescription.issued_at).toLocaleDateString()
            : new Date().toLocaleDateString();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Prescription Slip - ${selectedPrescription.prescription_id}</title>
                    <style>
                        @media print {
                            body { margin: 0; padding: 0; }
                            @page { margin: 20mm; }
                        }
                        body { 
                            font-family: 'Times New Roman', serif; 
                            padding: 40px; 
                            max-width: 800px; 
                            margin: 0 auto;
                            color: #000;
                        }
                        .header { 
                            text-align: center; 
                            border-bottom: 2px solid #333; 
                            padding-bottom: 15px; 
                            margin-bottom: 30px;
                        }
                        h1 { 
                            margin: 0 0 10px 0; 
                            font-size: 28px; 
                            font-weight: bold;
                        }
                        .header p { 
                            margin: 0; 
                            font-size: 16px; 
                        }
                        .patient-info { 
                            margin: 20px 0; 
                            line-height: 1.8;
                        }
                        .patient-info p { 
                            margin: 8px 0; 
                        }
                        .prescription-box { 
                            border: 2px solid #333; 
                            padding: 25px; 
                            margin: 25px 0; 
                            min-height: 200px;
                        }
                        .prescription-box h2 { 
                            color: #0056b3; 
                            margin-top: 0; 
                            font-size: 24px;
                        }
                        .prescription-box h3 { 
                            margin: 15px 0 10px 0; 
                            font-size: 20px; 
                        }
                        .prescription-box p { 
                            margin: 10px 0; 
                            line-height: 1.6;
                        }
                        .signature-area { 
                            margin-top: 60px; 
                            display: flex; 
                            justify-content: space-between; 
                        }
                        .signature-box { 
                            width: 250px; 
                        }
                        .signature-line { 
                            border-top: 1px solid #333; 
                            padding-top: 8px; 
                            margin-bottom: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>CITY MEDICAL CENTER</h1>
                        <p>Official Prescription Slip</p>
                    </div>
                    <div class="patient-info">
                        <p><strong>Patient Name:</strong> ${patientName}</p>
                        <p><strong>Patient Email:</strong> ${patientEmail}</p>
                        <p><strong>Date:</strong> ${issueDate}</p>
                        <p><strong>Prescription ID:</strong> #${selectedPrescription.prescription_id}</p>
                    </div>
                    <div class="prescription-box">
                        <h2>Rx</h2>
                        <h3>${selectedPrescription.medicine_name || 'N/A'}</h3>
                        <p><strong>Dosage:</strong> ${selectedPrescription.dosage || 'N/A'}</p>
                        <p><strong>Instructions:</strong> ${selectedPrescription.instructions || 'N/A'}</p>
                    </div>
                    <div class="signature-area">
                        <div class="signature-box">
                            <div class="signature-line">____________________</div>
                            <div>Doctor Signature</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line">____________________</div>
                            <div>Hospital Stamp</div>
                        </div>
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
            // Optionally close after printing (user can cancel)
            // printWindow.close();
        }, 250);
    };

    return (
        <>
            {/* Print-specific styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-prescription-content,
                    .print-prescription-content * {
                        visibility: visible;
                    }
                    .print-prescription-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
            <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
                <h2>Receptionist Management</h2>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                    <input
                        type="email" placeholder="Search Patient Email..."
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        style={{ flex: 1, padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                    <button type="submit" style={{ padding: '12px 25px', background: '#0056b3', color: 'white', border: 'none', borderRadius: '5px' }}>
                        Find Records
                    </button>
                </form>

                {/* Recent Prescriptions Section - Only show when no search results */}
                {!data && (
                    <div style={{ marginBottom: '30px' }}>
                        <h3 style={{ marginBottom: '15px', color: '#333' }}>Recent Prescriptions</h3>
                        {loadingRecent ? (
                            <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading recent prescriptions...</p>
                        ) : recentPrescriptions.length === 0 ? (
                            <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No prescriptions found.</p>
                        ) : (
                            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                            <th style={styles.th}>Patient</th>
                                            <th style={styles.th}>Medicine</th>
                                            <th style={styles.th}>Doctor</th>
                                            <th style={styles.th}>Issued Date</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentPrescriptions.map(p => (
                                            <tr key={p.prescription_id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={styles.td}>
                                                    <div>
                                                        <strong>{p.patient_name || p.patient_email}</strong>
                                                        {p.patient_name && <div style={{ fontSize: '0.85rem', color: '#666' }}>{p.patient_email}</div>}
                                                    </div>
                                                </td>
                                                <td style={styles.td}>{p.medicine_name}</td>
                                                <td style={styles.td}>{p.doctor_name || 'N/A'}</td>
                                                <td style={styles.td}>{new Date(p.issued_at).toLocaleDateString()}</td>
                                                <td style={styles.td}>
                                                    <button
                                                        onClick={() => {
                                                            // Set patient data for printing
                                                            setData({
                                                                full_name: p.patient_name || p.patient_email,
                                                                email: p.patient_email,
                                                                phone: null,
                                                                prescriptions: [p]
                                                            });
                                                            setSelectedPrescription(p);
                                                        }}
                                                        style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}
                                                    >
                                                        Generate Slip
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Search Results Section - Only show when search is performed */}
                {data && (
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>Patient: {data.full_name}</h3>
                                <button
                                    onClick={() => setData(null)}
                                    style={{ background: '#6c757d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
                                >
                                    Back to Recent Prescriptions
                                </button>
                            </div>
                            <p>Email: {data.email} | Phone: {data.phone}</p>

                            <h4>Active Prescriptions</h4>
                            {data.prescriptions.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                    <thead>
                                        <tr style={{ background: '#eee' }}>
                                            <th style={styles.th}>Medicine</th>
                                            <th style={styles.th}>Issued Date</th>
                                            <th style={styles.th}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.prescriptions.map(p => (
                                            <tr key={p.prescription_id}>
                                                <td style={styles.td}>{p.medicine_name}</td>
                                                <td style={styles.td}>{new Date(p.issued_at).toLocaleDateString()}</td>
                                                <td style={styles.td}>
                                                    <button
                                                        onClick={() => setSelectedPrescription(p)}
                                                        style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px' }}
                                                    >
                                                        Generate Slip
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p>No prescriptions found.</p>}
                        </div>
                    </div>
                )}

                {/* PREVIEW & PRINT AREA */}
                {selectedPrescription && (
                    <div style={{ marginTop: '30px', border: '1px solid #ddd', padding: '20px', background: 'white' }}>
                        <div ref={componentRef} className="print-prescription-content" style={styles.printTemplate}>
                            <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                                <h1 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>CITY MEDICAL CENTER</h1>
                                <p style={{ margin: 0, fontSize: '16px' }}>Official Prescription Slip</p>
                            </div>
                            <div style={{ margin: '20px 0' }}>
                                <p style={{ margin: '8px 0' }}><strong>Patient Name:</strong> {data?.full_name || selectedPrescription.patient_name || selectedPrescription.patient_email || 'N/A'}</p>
                                <p style={{ margin: '8px 0' }}><strong>Patient Email:</strong> {data?.email || selectedPrescription.patient_email || 'N/A'}</p>
                                <p style={{ margin: '8px 0' }}><strong>Date:</strong> {selectedPrescription.issued_at ? new Date(selectedPrescription.issued_at).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                                <p style={{ margin: '8px 0' }}><strong>Prescription ID:</strong> #{selectedPrescription.prescription_id}</p>
                            </div>
                            <div style={{ border: '1px solid #333', padding: '20px', minHeight: '200px', marginTop: '20px' }}>
                                <h2 style={{ color: '#0056b3', marginTop: 0 }}>Rx</h2>
                                <h3 style={{ margin: '10px 0', fontSize: '20px' }}>{selectedPrescription.medicine_name}</h3>
                                <p style={{ margin: '10px 0' }}><strong>Dosage:</strong> {selectedPrescription.dosage || 'N/A'}</p>
                                <p style={{ margin: '10px 0' }}><strong>Instructions:</strong> {selectedPrescription.instructions || 'N/A'}</p>
                            </div>
                            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                                <div style={{ width: '200px' }}>
                                    <div style={{ borderTop: '1px solid #333', paddingTop: '5px' }}>____________________</div>
                                    <div style={{ marginTop: '5px' }}>Doctor Signature</div>
                                </div>
                                <div style={{ width: '200px' }}>
                                    <div style={{ borderTop: '1px solid #333', paddingTop: '5px' }}>____________________</div>
                                    <div style={{ marginTop: '5px' }}>Hospital Stamp</div>
                                </div>
                            </div>
                        </div>
                        <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button onClick={handlePrint} style={styles.printBtn}>🖨️ Print Prescription</button>
                            <button onClick={() => setSelectedPrescription(null)} style={styles.cancelBtn}>Close Preview</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

const styles = {
    th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #ddd' },
    td: { padding: '12px', borderBottom: '1px solid #ddd' },
    printBtn: { flex: 1, padding: '15px', background: '#333', color: 'white', fontSize: '1.1rem', cursor: 'pointer', border: 'none', borderRadius: '5px', fontWeight: 'bold' },
    cancelBtn: { padding: '15px 25px', background: '#6c757d', color: 'white', fontSize: '1.1rem', cursor: 'pointer', border: 'none', borderRadius: '5px', fontWeight: 'bold' },
    printTemplate: {
        padding: '40px',
        background: 'white',
        color: 'black',
        fontFamily: 'serif',
        maxWidth: '800px',
        margin: '0 auto',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
    }
};