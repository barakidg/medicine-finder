import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Middleware to verify doctor and check if verified
const verifyDoctor = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Doctor') {
            return res.status(403).json({ error: "Only doctors can issue prescriptions" });
        }

        // Check if doctor is verified and not suspended/banned
        const doctor = await pool.query(
            'SELECT verified, status FROM users WHERE user_id = $1',
            [verified.id]
        );

        if (!doctor.rows[0]) {
            return res.status(404).json({ error: "Doctor not found" });
        }

        const doctorStatus = doctor.rows[0].status || 'active';
        if (doctorStatus === 'banned') {
            return res.status(403).json({ error: "Your account is banned." });
        }
        if (doctorStatus === 'suspended') {
            return res.status(403).json({ error: "Your account is suspended. You can log in, but you cannot issue prescriptions." });
        }

        if (!doctor.rows[0].verified) {
            return res.status(403).json({
                error: "Your account is pending verification. Please wait for admin approval before issuing prescriptions."
            });
        }

        req.doctor_id = verified.id;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        res.status(500).json({ error: err.message });
    }
};

// 1. Issue a New Prescription (Protected - Verified Doctors only)
router.post('/issue', verifyDoctor, async (req, res) => {
    const { patient_email, medicine_id, dosage, instructions } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO prescriptions (doctor_id, patient_email, medicine_id, dosage, instructions)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.doctor_id, patient_email, medicine_id, dosage, instructions]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get Prescriptions for a specific Patient
router.get('/my-prescriptions/:email', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, m.name as medicine_name 
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.medicine_id
             WHERE p.patient_email = $1`,
            [req.params.email]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Patient Prescriptions for Pharmacist (Protected - Pharmacists only)
router.get('/patient/:email', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Pharmacist') {
            return res.status(403).json({ error: "Only pharmacists can access patient prescriptions" });
        }

        // Get patient info
        const patientRes = await pool.query(
            'SELECT user_id, full_name, email, phone_number FROM users WHERE LOWER(email) = LOWER($1) AND role = $2',
            [req.params.email, 'Patient']
        );

        if (patientRes.rows.length === 0) {
            return res.status(404).json({ error: "Patient not found" });
        }

        const patient = patientRes.rows[0];

        // Get all prescriptions for this patient
        const prescriptionsRes = await pool.query(
            `SELECT p.prescription_id, p.dosage, p.instructions, p.issued_at, p.status,
                    m.name as medicine_name,
                    u.full_name as doctor_name
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.medicine_id
             LEFT JOIN users u ON p.doctor_id = u.user_id
             WHERE LOWER(p.patient_email) = LOWER($1)
             ORDER BY p.issued_at DESC`,
            [req.params.email]
        );

        res.json({
            patient: {
                name: patient.full_name,
                email: patient.email,
                phone: patient.phone_number
            },
            prescriptions: prescriptionsRes.rows
        });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        res.status(500).json({ error: err.message });
    }
});

// 4. Mark Prescription as Fulfilled (Protected - Pharmacists and Patients)
router.put('/:id/fulfill', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        // Allow both pharmacists and patients
        if (verified.role !== 'Pharmacist' && verified.role !== 'Patient') {
            return res.status(403).json({ error: "Only pharmacists and patients can fulfill prescriptions" });
        }

        // If patient, verify they own this prescription
        if (verified.role === 'Patient') {
            const prescriptionRes = await pool.query(
                'SELECT patient_email FROM prescriptions WHERE prescription_id = $1',
                [req.params.id]
            );

            if (prescriptionRes.rows.length === 0) {
                return res.status(404).json({ error: "Prescription not found" });
            }

            const userRes = await pool.query(
                'SELECT email FROM users WHERE user_id = $1',
                [verified.id]
            );

            if (userRes.rows.length === 0 ||
                userRes.rows[0].email.toLowerCase() !== prescriptionRes.rows[0].patient_email.toLowerCase()) {
                return res.status(403).json({ error: "You can only fulfill your own prescriptions" });
            }
        }

        // Update prescription status to Fulfilled
        const result = await pool.query(
            'UPDATE prescriptions SET status = $1 WHERE prescription_id = $2 RETURNING *',
            ['Fulfilled', req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Prescription not found" });
        }

        res.json({
            message: "Prescription marked as fulfilled",
            prescription: result.rows[0]
        });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete Prescription (Protected - Patients can delete their own)
router.delete('/:id', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        // Get prescription details to verify ownership
        const prescriptionRes = await pool.query(
            'SELECT patient_email FROM prescriptions WHERE prescription_id = $1',
            [req.params.id]
        );

        if (prescriptionRes.rows.length === 0) {
            return res.status(404).json({ error: "Prescription not found" });
        }

        // If patient, verify they own this prescription
        if (verified.role === 'Patient') {
            const userRes = await pool.query(
                'SELECT email FROM users WHERE user_id = $1',
                [verified.id]
            );

            if (userRes.rows.length === 0 ||
                userRes.rows[0].email.toLowerCase() !== prescriptionRes.rows[0].patient_email.toLowerCase()) {
                return res.status(403).json({ error: "You can only delete your own prescriptions" });
            }
        }

        // Delete prescription
        await pool.query('DELETE FROM prescriptions WHERE prescription_id = $1', [req.params.id]);

        res.json({ message: "Prescription deleted successfully" });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        res.status(500).json({ error: err.message });
    }
});

export default router;