// Pequeña capa de comunicación con el servidor (con PIN de administrador).
const PIN_KEY = 'turnos_admin_pin';

export const getStoredPin = (): string => {
  try { return sessionStorage.getItem(PIN_KEY) || ''; } catch { return ''; }
};
export const setStoredPin = (pin: string) => {
  try { if (pin) sessionStorage.setItem(PIN_KEY, pin); else sessionStorage.removeItem(PIN_KEY); } catch { /* sin almacenamiento */ }
};

export const adminFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': getStoredPin(), ...(init.headers || {}) },
  });
