export const APP_SHARE_URL =
  import.meta.env.VITE_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://ccfbc-lineup-manager-code.vercel.app');
