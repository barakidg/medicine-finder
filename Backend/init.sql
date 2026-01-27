-- Medicine Finder Database Schema Initialization
-- This script creates all required tables for the application

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
-- Stores all user accounts (patients, doctors, pharmacists, receptionists, admins)
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

-- 2. PHARMACIES TABLE
-- Stores pharmacy information
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

-- 3. MEDICINES TABLE
-- Stores medicine catalog
CREATE TABLE IF NOT EXISTS medicines (
    medicine_id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. INVENTORY TABLE
-- Stores pharmacy stock levels
CREATE TABLE IF NOT EXISTS inventory (
    pharmacy_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pharmacy_id, medicine_id),
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE
);

-- 5. PRESCRIPTIONS TABLE
-- Stores doctor prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL,
    patient_email VARCHAR(255) NOT NULL,
    medicine_id INTEGER NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    instructions TEXT,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled')),
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE
);

-- 6. FEEDBACK TABLE
-- Stores patient pharmacy reviews
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL,
    pharmacy_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Removed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE
);

-- Add foreign key constraint for users.pharmacy_id (after pharmacies table is created)
ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_pharmacy_id_fkey;

ALTER TABLE users 
    ADD CONSTRAINT users_pharmacy_id_fkey 
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(pharmacy_id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_pharmacy_id ON users(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_verified ON pharmacies(verified);
CREATE INDEX IF NOT EXISTS idx_pharmacies_status ON pharmacies(status);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy ON inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_email ON prescriptions(patient_email);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_pharmacy ON feedback(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Insert default admin user (password: admin)
-- Password hash for 'admin' using bcrypt with salt rounds 10
INSERT INTO users (full_name, email, password_hash, role, verified, status)
VALUES ('System Admin', 'admin@medicinefinder.com', '$2b$10$V3piuS37LI0w5bZivj/fiB1lYR23jvJO', 'Admin', TRUE, 'active')
ON CONFLICT (email) DO NOTHING;

-- Insert sample medicines for testing
INSERT INTO medicines (name, description, category) VALUES
    ('Paracetamol', 'Pain reliever and fever reducer', 'Analgesic'),
    ('Amoxicillin', 'Antibiotic for bacterial infections', 'Antibiotic'),
    ('Ibuprofen', 'Anti-inflammatory pain reliever', 'Analgesic'),
    ('Aspirin', 'Pain reliever and blood thinner', 'Analgesic'),
    ('Metformin', 'Diabetes medication', 'Antidiabetic')
ON CONFLICT (name) DO NOTHING;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Medicine Finder database schema initialized successfully!';
END $$;
