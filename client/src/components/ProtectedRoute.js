import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    // Show nothing or a spinner while checking localStorage
    if (loading) return <div>Loading...</div>;

    if (!user) {
        // Redirect to login but save the location they were trying to go to
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // If user role isn't allowed, send them to an unauthorized page or home
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;