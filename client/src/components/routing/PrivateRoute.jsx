import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function PrivateRoute() {
  const { user } = useAuth();
  const parentContext = useOutletContext();

  if (user == null) {
    return <Navigate to="/login" replace />;
  }

  // Forward AppLayout outlet context to nested routes (e.g. Dashboard).
  return <Outlet context={parentContext} />;
}
