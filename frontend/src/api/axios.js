import axios from 'axios';

// Backend adresi tek yerden yönetilir.
// Farklı bir adres gerekiyorsa frontend/.env dosyasına VITE_API_URL=... yazmak yeterli.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
