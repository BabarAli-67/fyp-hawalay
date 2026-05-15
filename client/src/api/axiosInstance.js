import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isAuthAttemptUrl(config) {
  const path = config?.url || '';
  return (
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/register') ||
    path.includes('/api/auth/google') ||
    path.includes('/api/auth/me')
  );
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && !error?.config?.skipAuthRedirect && !isAuthAttemptUrl(error?.config)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
