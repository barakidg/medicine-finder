import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext.js';
import Navbar from './components/Navbar.js';
import ProtectedRoute from './components/ProtectedRoute.js';

// Import Pages
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import MedicineSearch from './pages/MedicineSearch.js';
import DoctorDashboard from './pages/DoctorDashboard.js';
import InventoryManager from './pages/InventoryManager.js';
import ReceptionistPanel from './pages/ReceptionistPanel.js';
import PatientProfile from './pages/PatientProfile.js';
import AdminDashboard from './pages/AdminDashboard.js';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="container">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<MedicineSearch />} />

            {/* Protected Routes - Wrapped individually for better stability */}
            <Route path="/patient" element={
              <ProtectedRoute allowedRoles={['Patient']}>
                <PatientProfile />
              </ProtectedRoute>
            } />

            <Route path="/doctor-dashboard" element={
              <ProtectedRoute allowedRoles={['Doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute allowedRoles={['Pharmacist']}>
                <InventoryManager />
              </ProtectedRoute>
            } />

            <Route path="/receptionist" element={
              <ProtectedRoute allowedRoles={['Receptionist']}>
                <ReceptionistPanel />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Default & Error Routes */}
            <Route path="/unauthorized" element={<h1 style={{ textAlign: 'center' }}>Access Denied</h1>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;