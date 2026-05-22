import { createContext, useContext } from 'react';

export const NotificationsContext = createContext(null);

export function useDispatchLocalNotification() {
  return useContext(NotificationsContext);
}
