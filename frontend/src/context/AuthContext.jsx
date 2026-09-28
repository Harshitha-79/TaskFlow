import { useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from './authContextValue';
import api, { setAccessToken } from '../services/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const ran = useRef(false); // StrictMode runs effects twice in dev; rotation would reject the 2nd call

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh/`, {}, { withCredentials: true }
        );
        setAccessToken(data.access);
        const me = await api.get('/auth/me/');
        setUser(me.data);
      } catch {
        // no valid session; stay logged out
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', { email, password });
      setAccessToken(data.access);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    setLoading(true);
    try {
      await api.post('/auth/signup/', { name, email, password }); // no confirm field
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout/'); } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);