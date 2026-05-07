import { useState, useCallback, useEffect } from 'react';

let toastListeners = [];
let toasts = [];

export const useToast = () => {
  const [localToasts, setLocalToasts] = useState(toasts);

  useEffect(() => {
    const listener = (newToasts) => setLocalToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    const newToast = { id, message, type };
    toasts = [...toasts, newToast];
    toastListeners.forEach(listener => listener(toasts));

    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      toastListeners.forEach(listener => listener(toasts));
    }, duration);
  }, []);

  return { toasts: localToasts, showToast };
};
