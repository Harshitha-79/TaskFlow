import { useContext } from 'react';
import { AuthContext } from '../context/authContextValue';

export const useAuth = () => useContext(AuthContext);