import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Middleware to get pharmacist's pharmacy_id
const getPharmacistPharmacy = async (req, res, next) => {
    if (req.user && req.user.role === 'Pharmacist') {
        try {
            const userRes = await pool.query(
                'SELECT pharmacy_id FROM users WHERE user_id = $1',
                [req.user.id]
            );
            if (userRes.rows[0] && userRes.rows[0].pharmacy_id) {
                req.pharmacy_id = userRes.rows[0].pharmacy_id;
            }
        } catch (err) {
            console.error("Error getting pharmacist pharmacy:", err);
        }
    }
    next();
};

// SEARCH INVENTORY (Only verified and active pharmacies)
router.get('/search', async (req, res) => {
    const { medName } = req.query;
    try {
        const result = await pool.query(
            `SELECT m.name as medicine, p.name as pharmacy, p.address, 
            p.latitude, p.longitude, p.pharmacy_id, i.quantity, i.status, i.price
            FROM inventory i
            JOIN medicines m ON i.medicine_id = m.medicine_id
            JOIN pharmacies p ON i.pharmacy_id = p.pharmacy_id
            WHERE m.name ILIKE $1 
            AND i.status != 'Out of Stock'
            AND p.verified = true
            AND (p.status IS NULL OR p.status = 'active')`,
            [`%${medName}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Inventory Search Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET ALL MEDICINES FOR PHARMACISTS (For inventory management dropdown - all medicines)
router.get('/all-medicines', async (req, res) => {
    try {
        // Return all medicines for pharmacists to manage their inventory
        const result = await pool.query(
            'SELECT medicine_id, name FROM medicines ORDER BY name'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET MEDICINES IN STOCK (For doctor's prescription dropdown - only medicines in stock)
router.get('/medicines', async (req, res) => {
    try {
        // Only return medicines that are in stock in at least one verified and active pharmacy
        const result = await pool.query(
            `SELECT DISTINCT m.medicine_id, m.name 
             FROM medicines m
             JOIN inventory i ON m.medicine_id = i.medicine_id
             JOIN pharmacies p ON i.pharmacy_id = p.pharmacy_id
             WHERE i.status != 'Out of Stock'
             AND p.verified = true
             AND (p.status IS NULL OR p.status = 'active')
             ORDER BY m.name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADD NEW MEDICINE (Protected - Verified Pharmacists only)
router.post('/add-medicine', async (req, res) => {
    const { name, description, category } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        // Verify token and get user
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Pharmacist') {
            return res.status(403).json({ error: "Only pharmacists can add new medicines" });
        }

        // Get pharmacist's pharmacy_id and verification status
        const userRes = await pool.query(
            'SELECT u.pharmacy_id, p.verified FROM users u LEFT JOIN pharmacies p ON u.pharmacy_id = p.pharmacy_id WHERE u.user_id = $1',
            [verified.id]
        );

        if (!userRes.rows[0] || !userRes.rows[0].pharmacy_id) {
            return res.status(404).json({ error: "Pharmacy not found. Please ensure your pharmacy is verified by admin." });
        }

        if (!userRes.rows[0].verified) {
            return res.status(403).json({ error: "Only verified pharmacies can add new medicines. Please wait for admin verification." });
        }

        // Validate medicine name
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: "Medicine name is required" });
        }

        // Check if medicine already exists (case-insensitive)
        const existingMedicine = await pool.query(
            'SELECT medicine_id FROM medicines WHERE LOWER(name) = LOWER($1)',
            [name.trim()]
        );

        if (existingMedicine.rows.length > 0) {
            return res.status(409).json({ error: "A medicine with this name already exists in the system" });
        }

        // Insert new medicine
        const result = await pool.query(
            'INSERT INTO medicines (name, description, category) VALUES ($1, $2, $3) RETURNING medicine_id, name, description, category',
            [name.trim(), description?.trim() || null, category?.trim() || null]
        );

        res.status(201).json({
            message: "Medicine added successfully",
            medicine: result.rows[0]
        });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        console.error("Add Medicine Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET PHARMACIST'S PHARMACY INVENTORY (Protected)
router.get('/my-inventory', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Pharmacist') {
            return res.status(403).json({ error: "Only pharmacists can access this" });
        }

        // Get pharmacist's pharmacy_id
        const userRes = await pool.query(
            'SELECT pharmacy_id FROM users WHERE user_id = $1',
            [verified.id]
        );

        if (!userRes.rows[0] || !userRes.rows[0].pharmacy_id) {
            return res.status(404).json({ error: "Pharmacy not found. Please ensure your pharmacy is verified." });
        }

        const pharmacy_id = userRes.rows[0].pharmacy_id;

        // Get inventory for this pharmacy
        const result = await pool.query(
            `SELECT m.name as medicine, m.medicine_id, i.quantity, i.status, i.price
             FROM inventory i
             JOIN medicines m ON i.medicine_id = m.medicine_id
             WHERE i.pharmacy_id = $1
             ORDER BY m.name`,
            [pharmacy_id]
        );

        res.json(result.rows);
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        res.status(500).json({ error: err.message });
    }
});

// UPDATE OR INSERT INVENTORY (Protected - Pharmacists only)
router.post('/update', async (req, res) => {
    const { medicine_id, quantity, price } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Please login." });
    }

    try {
        // Verify token and get user
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        if (verified.role !== 'Pharmacist') {
            return res.status(403).json({ error: "Only pharmacists can update inventory" });
        }

        // ===== INPUT VALIDATION =====

        // Validate medicine_id
        if (!medicine_id) {
            return res.status(400).json({ error: "Medicine selection is required" });
        }

        // Validate quantity
        if (quantity === undefined || quantity === null || quantity === '') {
            return res.status(400).json({ error: "Quantity is required" });
        }

        const qty = parseInt(quantity);
        if (isNaN(qty)) {
            return res.status(400).json({ error: "Quantity must be a valid number" });
        }

        if (qty < 0) {
            return res.status(400).json({ error: "Quantity cannot be negative" });
        }

        if (qty > 999999) {
            return res.status(400).json({ error: "Quantity cannot exceed 999,999 units" });
        }

        if (!Number.isInteger(qty)) {
            return res.status(400).json({ error: "Quantity must be a whole number" });
        }

        // Validate price
        if (price === undefined || price === null || price === '') {
            return res.status(400).json({ error: "Price is required" });
        }

        const priceNum = parseFloat(price);
        if (isNaN(priceNum)) {
            return res.status(400).json({ error: "Price must be a valid number" });
        }

        if (priceNum < 0) {
            return res.status(400).json({ error: "Price cannot be negative" });
        }

        if (priceNum === 0) {
            return res.status(400).json({ error: "Price must be greater than zero" });
        }

        if (priceNum > 999999.99) {
            return res.status(400).json({ error: "Price cannot exceed 999,999.99 ETB" });
        }

        // Validate decimal places (max 2)
        const decimalPlaces = (priceNum.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return res.status(400).json({ error: "Price can have at most 2 decimal places" });
        }

        // Verify medicine exists
        const medicineCheck = await pool.query(
            'SELECT medicine_id FROM medicines WHERE medicine_id = $1',
            [medicine_id]
        );

        if (medicineCheck.rows.length === 0) {
            return res.status(404).json({ error: "Selected medicine does not exist" });
        }

        // ===== END VALIDATION =====

        // Calculate status automatically based on quantity
        // In Stock (>= 5), Low Stock (<= 5), or Out of Stock (0)
        // We'll use: 0 = Out, 1-4 = Low, >= 5 = In
        let calculatedStatus = 'In Stock';
        if (qty === 0) {
            calculatedStatus = 'Out of Stock';
        } else if (qty < 5) {
            calculatedStatus = 'Low Stock';
        }

        // Get pharmacist's pharmacy_id
        const userRes = await pool.query(
            'SELECT pharmacy_id FROM users WHERE user_id = $1',
            [verified.id]
        );

        if (!userRes.rows[0] || !userRes.rows[0].pharmacy_id) {
            return res.status(404).json({ error: "Pharmacy not found. Please ensure your pharmacy is verified by admin." });
        }

        const pharmacy_id = userRes.rows[0].pharmacy_id;

        // Round price to 2 decimal places
        const roundedPrice = Math.round(priceNum * 100) / 100;

        // Update inventory
        await pool.query(
            `INSERT INTO inventory (pharmacy_id, medicine_id, quantity, price, status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE 
             SET quantity = $3, price = $4, status = $5`,
            [pharmacy_id, medicine_id, qty, roundedPrice, calculatedStatus]
        );

        res.json({ message: "Stock updated successfully", status: calculatedStatus });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        console.error("Update Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;