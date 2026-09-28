import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../services/api';

export default function ProtectedRoute({ children }) {
  const { loading } = useAuth();
  const token = getAccessToken();

  if (loading) return <p role="status" className="p-6">Restoring session...</p>;
  if (!token) return <Navigate to="/login" replace />;
  
  return children;
}
