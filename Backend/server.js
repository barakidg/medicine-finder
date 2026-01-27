import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './db.js';
import inventoryRoutes from './routes/inventory.js';
import prescriptionsRoutes from './routes/prescriptions.js';
import feedbackRoutes from './routes/feedback.js';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to verify JWT and Role
const authenticateToken = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ error: "Access Denied" });

        try {
            const verified = jwt.verify(token, process.env.JWT_SECRET);
            req.user = verified;

            if (roles.length && !roles.includes(verified.role)) {
                return res.status(403).json({ error: "Insufficient permissions" });
            }
            next();
        } catch (err) {
            res.status(400).json({ error: "Invalid Token" });
        }
    };
};

// Apply Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/feedback', feedbackRoutes);

// --- ADMIN ROUTES (#2 Improvement) ---

// 1. Get all pharmacies for verification
app.get('/api/admin/pharmacies', authenticateToken(['Admin']), async (req, res) => {
    try {
        const result = await pool.query('SELECT pharmacy_id, name, address, contact_number, verified, status, latitude, longitude FROM pharmacies ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching pharmacies:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Verify a pharmacy
app.put('/api/admin/pharmacies/:id/verify', authenticateToken(['Admin']), async (req, res) => {
    try {
        // Update pharmacy to verified
        await pool.query('UPDATE pharmacies SET verified = true WHERE pharmacy_id = $1', [req.params.id]);
        res.json({ message: "Pharmacy verified successfully. The pharmacist can now manage inventory and view feedback." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get all users for management
app.get('/api/admin/users', authenticateToken(['Admin']), async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, full_name, email, role, verified, status, phone_number, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3b. Search users (Admin only) - returns users with pharmacy info for pharmacists
app.get('/api/admin/users/search', authenticateToken(['Admin']), async (req, res) => {
    const { query } = req.query;
    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
    }
    try {
        const searchTerm = `%${query.trim()}%`;
        const result = await pool.query(
            `SELECT u.user_id, u.full_name, u.email, u.role, u.verified, u.status, u.phone_number, u.created_at, u.pharmacy_id,
                    p.pharmacy_id as pharmacy_pharmacy_id, p.name as pharmacy_name, p.address as pharmacy_address, 
                    p.contact_number as pharmacy_contact, p.verified as pharmacy_verified, p.status as pharmacy_status
             FROM users u
             LEFT JOIN pharmacies p ON u.pharmacy_id = p.pharmacy_id
             WHERE (LOWER(u.full_name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1))
             ORDER BY u.created_at DESC`,
            [searchTerm]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Verify a doctor
app.put('/api/admin/doctors/:id/verify', authenticateToken(['Admin']), async (req, res) => {
    try {
        await pool.query('UPDATE users SET verified = true WHERE user_id = $1 AND role = $2', [req.params.id, 'Doctor']);
        res.json({ message: "Doctor verified successfully. They can now issue prescriptions." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Suspend/Ban/Reactivate User
app.put('/api/admin/users/:id/status', authenticateToken(['Admin']), async (req, res) => {
    const { status } = req.body; // 'active', 'suspended', 'banned'
    try {
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Must be 'active', 'suspended', or 'banned'" });
        }
        // If pharmacist is suspended/un-suspended, also hide/show their pharmacy from patient search results
        const userRes = await pool.query(
            'SELECT role, pharmacy_id FROM users WHERE user_id = $1',
            [req.params.id]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const { role, pharmacy_id } = userRes.rows[0];

        await pool.query('UPDATE users SET status = $1 WHERE user_id = $2', [status, req.params.id]);

        // Suspend pharmacist means: pharmacist can log in & manage inventory, but NOT visible in patient search
        if (role === 'Pharmacist' && pharmacy_id) {
            if (status === 'suspended') {
                // Don't override a banned pharmacy
                await pool.query(
                    `UPDATE pharmacies 
                     SET status = 'suspended' 
                     WHERE pharmacy_id = $1 AND (status IS NULL OR status <> 'banned')`,
                    [pharmacy_id]
                );
            } else if (status === 'active') {
                // Only restore if it was suspended (don't override banned)
                await pool.query(
                    `UPDATE pharmacies 
                     SET status = 'active' 
                     WHERE pharmacy_id = $1 AND status = 'suspended'`,
                    [pharmacy_id]
                );
            }
        }

        res.json({ message: `User ${status === 'active' ? 'reactivated' : status} successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Suspend/Ban/Reactivate Pharmacy
app.put('/api/admin/pharmacies/:id/status', authenticateToken(['Admin']), async (req, res) => {
    const { status } = req.body; // 'active', 'suspended', 'banned'
    try {
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Must be 'active', 'suspended', or 'banned'" });
        }
        // Update pharmacy status
        await pool.query('UPDATE pharmacies SET status = $1 WHERE pharmacy_id = $2', [status, req.params.id]);

        // Propagate consequences to linked pharmacists (users.pharmacy_id = pharmacy_id)
        // - Suspend: pharmacist can login but sees suspended banner (status = 'suspended')
        // - Ban: pharmacist cannot login (status = 'banned')
        // - Active: restore pharmacist accounts to active
        if (status === 'suspended') {
            await pool.query(
                `UPDATE users 
                 SET status = 'suspended' 
                 WHERE pharmacy_id = $1 AND role = 'Pharmacist' AND (status IS NULL OR status <> 'banned')`,
                [req.params.id]
            );
        } else if (status === 'banned') {
            await pool.query(
                `UPDATE users 
                 SET status = 'banned' 
                 WHERE pharmacy_id = $1 AND role = 'Pharmacist'`,
                [req.params.id]
            );
        } else if (status === 'active') {
            await pool.query(
                `UPDATE users 
                 SET status = 'active' 
                 WHERE pharmacy_id = $1 AND role = 'Pharmacist' AND status IN ('suspended', 'banned')`,
                [req.params.id]
            );
        }

        res.json({ message: `Pharmacy ${status === 'active' ? 'reactivated' : status} successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Delete user (Admin only) - used after banning
app.delete('/api/admin/users/:id', authenticateToken(['Admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userRes = await client.query(
            'SELECT user_id, role, pharmacy_id, email FROM users WHERE user_id = $1',
            [req.params.id]
        );
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        const userRow = userRes.rows[0];

        // Remove dependent rows that likely reference the user
        await client.query('DELETE FROM feedback WHERE patient_id = $1', [userRow.user_id]);
        await client.query('DELETE FROM prescriptions WHERE doctor_id = $1', [userRow.user_id]);

        // (Prescriptions for patients are stored by patient_email; deleting patient doesn't require delete here)
        // If you want to delete a patient's prescriptions too:
        // await client.query('DELETE FROM prescriptions WHERE LOWER(patient_email) = LOWER($1)', [userRow.email]);

        await client.query('DELETE FROM users WHERE user_id = $1', [userRow.user_id]);

        await client.query('COMMIT');
        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 8. Delete pharmacy (Admin only) - used after banning
app.delete('/api/admin/pharmacies/:id', authenticateToken(['Admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pharmacyRes = await client.query(
            'SELECT pharmacy_id FROM pharmacies WHERE pharmacy_id = $1',
            [req.params.id]
        );
        if (pharmacyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pharmacy not found' });
        }

        // Permanently delete linked pharmacist accounts too
        // (Delete dependent rows that may reference pharmacist users)
        const pharmacistUsers = await client.query(
            `SELECT user_id 
             FROM users 
             WHERE pharmacy_id = $1 AND role = 'Pharmacist'`,
            [req.params.id]
        );

        for (const row of pharmacistUsers.rows) {
            await client.query('DELETE FROM prescriptions WHERE doctor_id = $1', [row.user_id]);
            await client.query('DELETE FROM feedback WHERE patient_id = $1', [row.user_id]);
        }

        await client.query(
            `DELETE FROM users 
             WHERE pharmacy_id = $1 AND role = 'Pharmacist'`,
            [req.params.id]
        );

        // Detach any remaining users from pharmacy (safety)
        await client.query('UPDATE users SET pharmacy_id = NULL WHERE pharmacy_id = $1', [req.params.id]);

        // Remove dependent rows
        await client.query('DELETE FROM inventory WHERE pharmacy_id = $1', [req.params.id]);
        await client.query('DELETE FROM feedback WHERE pharmacy_id = $1', [req.params.id]);

        await client.query('DELETE FROM pharmacies WHERE pharmacy_id = $1', [req.params.id]);

        await client.query('COMMIT');
        res.json({ message: 'Pharmacy deleted successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 5. Moderate Feedback
app.get('/api/admin/feedback', authenticateToken(['Admin']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.*, u.full_name as patient_name, p.name as pharmacy_name 
            FROM feedback f
            JOIN users u ON f.patient_id = u.user_id
            JOIN pharmacies p ON f.pharmacy_id = p.pharmacy_id
            WHERE f.status = 'Pending'
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/feedback/:id', authenticateToken(['Admin']), async (req, res) => {
    const { status } = req.body; // 'Approved' or 'Removed'
    try {
        await pool.query('UPDATE feedback SET status = $1 WHERE feedback_id = $2', [status, req.params.id]);
        res.json({ message: `Feedback ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AUTH ROUTES ---

// Validation helper functions
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    // Accept any password - no validation requirements
    return { valid: true };
};

const validateEthiopianPhone = (phone) => {
    if (!phone) return { valid: true }; // Phone is optional
    // Ethiopian format: +251XXXXXXXXX or 0XXXXXXXXX (9 digits after prefix)
    const phoneRegex = /^(\+251|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

app.post('/api/auth/register', async (req, res) => {
    let { fullName, email, password, role, phone, pharmacyDetails } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ===== INPUT VALIDATION =====

        // Validate full name
        if (!fullName || fullName.trim().length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Full name is required" });
        }
        fullName = fullName.trim();

        if (fullName.length < 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Full name must be at least 2 characters" });
        }

        // Validate email
        if (!email || email.trim().length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Email is required" });
        }
        email = email.trim().toLowerCase();

        if (!validateEmail(email)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Check if email already exists
        const existingUser = await client.query(
            'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "Email already registered" });
        }

        // Validate password
        if (!password || password.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Password is required" });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Validate role
        const validRoles = ['Patient', 'Doctor', 'Pharmacist', 'Receptionist', 'Admin'];
        if (!role || !validRoles.includes(role)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Invalid role selected" });
        }

        // Validate phone number (optional but must be valid if provided)
        if (phone) {
            phone = phone.trim();
            if (!validateEthiopianPhone(phone)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Invalid phone number format. Use Ethiopian format: +251XXXXXXXXX or 0XXXXXXXXX" });
            }
        }

        // Validate pharmacy details for pharmacists
        if (role === 'Pharmacist' && pharmacyDetails) {
            if (!pharmacyDetails.pharmacyName || pharmacyDetails.pharmacyName.trim().length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Pharmacy name is required" });
            }
            if (!pharmacyDetails.pharmacyAddress || pharmacyDetails.pharmacyAddress.trim().length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Pharmacy address is required" });
            }
            if (pharmacyDetails.contactNumber && !validateEthiopianPhone(pharmacyDetails.contactNumber)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Invalid pharmacy contact number format" });
            }
        }

        // ===== END VALIDATION =====

        // Create user - set verified = false for Doctors and Pharmacists, true for others
        const salt = await bcrypt.genSalt(10);
        const hashedPwd = await bcrypt.hash(password, salt);
        const needsVerification = (role === 'Doctor' || role === 'Pharmacist');
        const userResult = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number, verified, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [fullName, email, hashedPwd, role, phone || null, needsVerification ? false : true, 'active']
        );

        const newUser = userResult.rows[0];
        let pharmacy_id = null;

        // If pharmacist, create pharmacy and link it
        if (role === 'Pharmacist' && pharmacyDetails) {
            const { pharmacyName, pharmacyAddress, contactNumber, latitude, longitude } = pharmacyDetails;

            // Use coordinates from frontend (user selected on map)
            // If not provided, try geocoding as fallback
            let lat = latitude;
            let lng = longitude;

            if (!lat || !lng) {
                try {
                    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pharmacyAddress)}&key=AIzaSyDVFoAFy4LSfELZ3C2Izd43zO1ac5AXSOY`;
                    const geocodeRes = await fetch(geocodeUrl);
                    const geocodeData = await geocodeRes.json();

                    if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
                        const location = geocodeData.results[0].geometry.location;
                        lat = location.lat;
                        lng = location.lng;
                    }
                } catch (geocodeErr) {
                    console.error("Geocoding error:", geocodeErr);
                }
            }

            // Create pharmacy with verified = false, status = 'active' by default
            const pharmacyResult = await client.query(
                `INSERT INTO pharmacies (name, address, latitude, longitude, contact_number, verified, status) 
                 VALUES ($1, $2, $3, $4, $5, false, 'active') RETURNING pharmacy_id`,
                [pharmacyName, pharmacyAddress, lat, lng, contactNumber || null]
            );

            pharmacy_id = pharmacyResult.rows[0].pharmacy_id;

            // Link pharmacist to pharmacy by adding pharmacy_id to users table
            // Note: This assumes you'll add pharmacy_id column to users table
            // If using a junction table instead, create that relationship here
            await client.query(
                'UPDATE users SET pharmacy_id = $1 WHERE user_id = $2',
                [pharmacy_id, newUser.user_id]
            );

            // Update the returned user object
            newUser.pharmacy_id = pharmacy_id;
        }

        await client.query('COMMIT');
        res.status(201).json({
            user: newUser,
            pharmacy_id: pharmacy_id,
            message: role === 'Pharmacist'
                ? 'Registration successful! Your pharmacy is pending admin verification.'
                : role === 'Doctor'
                    ? 'Registration successful! Your account is pending admin verification before you can issue prescriptions.'
                    : 'Registration successful! Please login.'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(400).json({ error: "User not found" });

        // Ban means: can't log in at all
        const userStatus = user.rows[0].status || 'active';
        if (userStatus === 'banned') {
            return res.status(403).json({ error: "Your account has been banned. Please contact administrator." });
        }

        const validPwd = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPwd) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign(
            { id: user.rows[0].user_id, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            token,
            user: {
                id: user.rows[0].user_id,
                name: user.rows[0].full_name,
                role: user.rows[0].role,
                email: user.rows[0].email,
                verified: user.rows[0].verified || false,
                status: userStatus
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Receptionist Routes

// Get recent prescriptions (for receptionist dashboard)
app.get('/api/reception/recent-prescriptions', authenticateToken(['Receptionist', 'Admin']), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50; // Default to 50 most recent
        const result = await pool.query(
            `SELECT p.prescription_id, p.patient_email, p.dosage, p.instructions, p.issued_at, p.status,
                    m.name as medicine_name,
                    u_patient.full_name as patient_name,
                    u_doctor.full_name as doctor_name
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.medicine_id
             LEFT JOIN users u_patient ON LOWER(u_patient.email) = LOWER(p.patient_email) AND u_patient.role = 'Patient'
             LEFT JOIN users u_doctor ON p.doctor_id = u_doctor.user_id AND u_doctor.role = 'Doctor'
             WHERE p.status IS NULL OR p.status != 'Fulfilled'
             ORDER BY p.issued_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reception/patient-records/:email', authenticateToken(['Receptionist', 'Admin']), async (req, res) => {
    try {
        // First check if patient exists
        const patient = await pool.query(
            'SELECT user_id, full_name, email, phone_number FROM users WHERE LOWER(email) = LOWER($1) AND role = $2',
            [req.params.email, 'Patient']
        );

        if (patient.rows.length === 0) {
            return res.status(404).json({ error: "Patient not found" });
        }

        const patientData = patient.rows[0];

        // Get all prescriptions for this patient
        const prescriptions = await pool.query(
            `SELECT p.prescription_id, p.dosage, p.instructions, p.issued_at, p.status,
                    m.name as medicine_name
             FROM prescriptions p
             JOIN medicines m ON p.medicine_id = m.medicine_id
             WHERE LOWER(p.patient_email) = LOWER($1)
             AND (p.status IS NULL OR p.status != 'Fulfilled')
             ORDER BY p.issued_at DESC`,
            [req.params.email]
        );

        const patientInfo = {
            full_name: patientData.full_name,
            email: patientData.email,
            phone: patientData.phone_number,
            prescriptions: prescriptions.rows
        };

        res.json(patientInfo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PHARMACIST ROUTES ---

// Get pharmacy feedback for the pharmacist's pharmacy
app.get('/api/pharmacist/feedback', authenticateToken(['Pharmacist']), async (req, res) => {
    try {
        // Get the pharmacy_id from the pharmacist's user record
        const userRes = await pool.query(
            'SELECT pharmacy_id FROM users WHERE user_id = $1',
            [req.user.id]
        );

        if (!userRes.rows[0] || !userRes.rows[0].pharmacy_id) {
            return res.status(404).json({ error: "No pharmacy found for this pharmacist. Please ensure your pharmacy is verified by admin." });
        }

        const pharmacy_id = userRes.rows[0].pharmacy_id;

        // Get pharmacy details
        const pharmacyRes = await pool.query(
            'SELECT name, address, status FROM pharmacies WHERE pharmacy_id = $1',
            [pharmacy_id]
        );

        if (pharmacyRes.rows.length === 0) {
            return res.status(404).json({ error: "Pharmacy not found" });
        }

        const pharmacy_name = pharmacyRes.rows[0].name;
        const pharmacy_address = pharmacyRes.rows[0].address;
        const pharmacy_status = pharmacyRes.rows[0].status || 'active';

        // Get approved feedback for this pharmacy
        const feedbackRes = await pool.query(
            `SELECT f.*, u.full_name as patient_name
             FROM feedback f
             JOIN users u ON f.patient_id = u.user_id
             WHERE f.pharmacy_id = $1 AND f.status = 'Approved'
             ORDER BY f.created_at DESC`,
            [pharmacy_id]
        );

        // Calculate average rating
        const avgRatingRes = await pool.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
             FROM feedback
             WHERE pharmacy_id = $1 AND status = 'Approved'`,
            [pharmacy_id]
        );

        const avgRating = avgRatingRes.rows[0].avg_rating
            ? parseFloat(avgRatingRes.rows[0].avg_rating).toFixed(1)
            : null;
        const totalReviews = parseInt(avgRatingRes.rows[0].total_reviews) || 0;

        res.json({
            pharmacy: {
                pharmacy_id,
                name: pharmacy_name,
                address: pharmacy_address,
                status: pharmacy_status
            },
            average_rating: avgRating,
            total_reviews: totalReviews,
            feedback: feedbackRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const superFix = async () => {
    try {
        console.log("Starting database initialization...");
        await pool.query(`DROP TABLE IF EXISTS feedback CASCADE;`);

        await pool.query(`
            CREATE TABLE feedback (
                feedback_id SERIAL PRIMARY KEY,
                patient_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                pharmacy_id INTEGER REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                status VARCHAR(20) DEFAULT 'pending', 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // 1. Create all tables from your init.sql schema
        await pool.query(`

            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('Patient', 'Doctor', 'Pharmacist', 'Receptionist', 'Admin')),
                phone_number VARCHAR(20),
                verified BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
                pharmacy_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pharmacies (
                pharmacy_id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                address TEXT NOT NULL,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                contact_number VARCHAR(20),
                verified BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS medicines (
                medicine_id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                category VARCHAR(100)
            );

            CREATE TABLE IF NOT EXISTS inventory (
                inventory_id SERIAL PRIMARY KEY,
                pharmacy_id INTEGER REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE,
                medicine_id INTEGER REFERENCES medicines(medicine_id) ON DELETE CASCADE,
                quantity INTEGER NOT NULL DEFAULT 0,
                price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'available',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                CONSTRAINT unique_pharmacy_medicine UNIQUE (pharmacy_id, medicine_id)
            );

            CREATE TABLE IF NOT EXISTS prescriptions (
                prescription_id SERIAL PRIMARY KEY,
                patient_email VARCHAR(255) NOT NULL,
                doctor_id INTEGER REFERENCES users(user_id),
                medicine_id INTEGER REFERENCES medicines(medicine_id),
                dosage VARCHAR(255),
                instructions TEXT,
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'pending'
            );

            

        `);
        console.log("✅ All tables checked/created.");

    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
    }
};

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public')));

    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

export default app; // Allow tests to import the app

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        superFix();
    });
}