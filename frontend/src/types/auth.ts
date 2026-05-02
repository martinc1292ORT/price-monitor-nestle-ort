export interface User {
  id: number;
  email: string;
  nombre: string;
  rol: 'admin' | 'viewer';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}