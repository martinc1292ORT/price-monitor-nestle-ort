import axios from 'axios';
import type { LoginCredentials, User } from '../types/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string }> {
    const { data } = await axios.post(`${BASE}/auth/login`, credentials, {
      withCredentials: true,
    });
    return data;
  },

  logout() {
    axios.post(`${BASE}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
  },
};