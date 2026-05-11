import { BellRing } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getPushSupportStatus,
  sendTestPushNotification,
  subscribeToLineupPushNotifications,
} from '../utils/pushNotifications';

export default function PhoneNotificationsButton() {
  const [status, setStatus] = useState(() => getPushSupportStatus());
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStatus(getPushSupportStatus());
  }, []);

  const statusText = useMemo(() => {
    return status.reason;
  }, [status]);

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');

    try {
      const result = await subscribeToLineupPushNotifications();
      setStatus(getPushSupportStatus());
      setMessage(result?.message || 'Phone notifications enabled.');
    } catch (error) {
      console.error('[LineupNotifications] failed to enable phone notifications:', error);
      setStatus(getPushSupportStatus());
      setMessage(error?.message || 'Unable to enable phone notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    setTestBusy(true);
    setMessage('');

    try {
      const result = await sendTestPushNotification();
      setMessage(`Test notification sent to ${result.sent || 0} device${result.sent === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('[PushNotifications] failed to send test notification:', error);
      setMessage(error?.message || 'Unable to send test notification.');
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-400">Phone notifications</p>
          <p className={`text-xs font-semibold ${status.permission === 'denied' || !status.supported ? 'text-amber-300' : 'text-slate-500'}`}>
            {statusText}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-black text-white transition-colors hover:border-blue-500/60 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleEnable}
          disabled={!status.canEnable || busy}
        >
          <BellRing size={14} aria-hidden="true" />
          {busy ? 'Enabling...' : 'Enable phone notifications'}
        </button>
      </div>
      <p className="text-xs font-medium leading-relaxed text-slate-500">
        For iPhone/iPad idle notifications, install this app to Home Screen first, then enable notifications.
      </p>
      {status.isIos && !status.isStandalone && (
        <p className="text-xs font-semibold text-amber-300">
          Install this app to Home Screen, then open it from the Home Screen icon to enable notifications.
        </p>
      )}
      {status.isVercelPreview && (
        <p className="text-xs font-semibold text-amber-300">
          Push subscriptions are tied to this exact URL. Delete old preview Home Screen apps and install from ccfbc-lineup-manager-code.vercel.app.
        </p>
      )}
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleSendTest}
        disabled={testBusy}
      >
        {testBusy ? 'Sending test...' : 'Send test notification'}
      </button>
      {message && <p className="text-xs font-semibold text-slate-300">{message}</p>}
    </div>
  );
}
