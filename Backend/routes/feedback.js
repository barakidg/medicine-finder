import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Middleware to verify JWT and ensure user is a Patient
const authenticatePatient = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access Denied. Please login." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Patient') {
            return res.status(403).json({ error: "Only patients can submit feedback" });
        }
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid Token" });
    }
};

// 1. Submit Feedback (Protected - Patients only)
router.post('/submit', authenticatePatient, async (req, res) => {
    const { pharmacy_id, rating, comment } = req.body;
    const patient_id = req.user.id; // Get from token instead of body for security

    // Validate input
    if (!pharmacy_id || !rating || !comment) {
        return res.status(400).json({ error: "Missing required fields: pharmacy_id, rating, comment" });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    try {
        // Suspend means: patient can log in, but cannot review/rate
        const patientStatusRes = await pool.query(
            'SELECT status FROM users WHERE user_id = $1',
            [patient_id]
        );
        const patientStatus = patientStatusRes.rows[0]?.status || 'active';
        if (patientStatus === 'banned') {
            return res.status(403).json({ error: "Your account is banned." });
        }
        if (patientStatus === 'suspended') {
            return res.status(403).json({ error: "Your account is suspended. You can log in, but you cannot submit reviews/ratings." });
        }

        const result = await pool.query(
            `INSERT INTO feedback (patient_id, pharmacy_id, rating, comment, status) 
             VALUES ($1, $2, $3, $4, 'Pending') RETURNING *`,
            [patient_id, pharmacy_id, rating, comment]
        );
        res.status(201).json({ message: "Feedback submitted for moderation", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get Approved Feedback for a specific pharmacy
router.get('/:pharmacyId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, u.full_name 
             FROM feedback f 
             JOIN users u ON f.patient_id = u.user_id 
             WHERE f.pharmacy_id = $1 AND f.status = 'Approved'
             ORDER BY f.created_at DESC`,
            [req.params.pharmacyId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;