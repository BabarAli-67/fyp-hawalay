import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function PrivateRoute() {
  const { user } = useAuth();
  if (user == null) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
