import { BellOff, BellRing, ClipboardCheck, RefreshCw, Send, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkLineupPushSubscriptionHealth,
  getNotificationDiagnostics,
  getPushSupportStatus,
  resubscribeToLineupPushNotifications,
  sendLocalDiagnosticNotification,
  sendTestPushNotification,
  subscribeToLineupPushNotifications,
  unsubscribeFromLineupPushNotifications,
} from '../utils/pushNotifications';

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function formatValue(value, empty = 'Not available') {
  if (value === true || value === false) return yesNo(value);
  if (value === null || typeof value === 'undefined' || value === '') return empty;
  return String(value);
}

function formatEndpoint(endpoint) {
  if (!endpoint) return 'No browser subscription';
  if (endpoint.length <= 34) return endpoint;
  return `${endpoint.slice(0, 18)}...${endpoint.slice(-12)}`;
}

function DiagnosticRow({ label, value, tone = 'slate' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-300';

  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 py-2 last:border-b-0">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className={`max-w-[13rem] break-words text-right text-xs font-semibold ${color}`}>{formatValue(value)}</dd>
    </div>
  );
}

export default function PhoneNotificationsButton() {
  const [status, setStatus] = useState(() => getPushSupportStatus());
  const [health, setHealth] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshHealth = useCallback(async (options = {}) => {
    const nextHealth = await checkLineupPushSubscriptionHealth(options);
    setStatus(nextHealth.support || getPushSupportStatus());
    setHealth(nextHealth);
    return nextHealth;
  }, []);

  const refreshDiagnostics = useCallback(async (options = {}) => {
    const nextDiagnostics = await getNotificationDiagnostics(options);
    setDiagnostics(nextDiagnostics);
    setStatus(nextDiagnostics.support || getPushSupportStatus());
    setHealth(nextDiagnostics.health || null);
    return nextDiagnostics;
  }, []);

  useEffect(() => {
    let active = true;

    getNotificationDiagnostics().then((nextDiagnostics) => {
      if (!active) return;
      setDiagnostics(nextDiagnostics);
      setStatus(nextDiagnostics.support || getPushSupportStatus());
      setHealth(nextDiagnostics.health || null);
    }).catch((error) => {
      console.error('[PushNotifications] health check failed:', error);
      if (!active) return;
      setHealth({ ok: false, code: 'health_check_failed', message: error?.message || 'Unable to check push subscription health.' });
      setStatus(getPushSupportStatus());
    });

    return () => {
      active = false;
    };
  }, []);

  const statusText = useMemo(() => {
    return health?.message || status.reason;
  }, [health, status.reason]);

  const enabled = Boolean(health?.ok);

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');

    try {
      const result = await subscribeToLineupPushNotifications();
      await refreshDiagnostics({ ensureRegistration: true, refreshServer: true });
      setMessage(result?.message || 'Phone notifications enabled for this device.');
    } catch (error) {
      console.error('[PushNotifications] failed to enable phone notifications:', error);
      await refreshHealth().catch(() => setStatus(getPushSupportStatus()));
      setMessage(error?.message || 'Unable to enable phone notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleResubscribe = async () => {
    setBusy(true);
    setMessage('');

    try {
      const result = await resubscribeToLineupPushNotifications();
      await refreshDiagnostics({ ensureRegistration: true, refreshServer: true });
      setMessage(result?.message || 'Device resubscribed for phone notifications.');
    } catch (error) {
      console.error('[PushNotifications] failed to resubscribe device:', error);
      await refreshDiagnostics().catch(() => setStatus(getPushSupportStatus()));
      setMessage(error?.message || 'Unable to resubscribe this device.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage('');

    try {
      const result = await unsubscribeFromLineupPushNotifications();
      await refreshDiagnostics();
      setMessage(result?.message || 'Phone notifications disabled for this device.');
    } catch (error) {
      console.error('[PushNotifications] failed to disable phone notifications:', error);
      setMessage(error?.message || 'Unable to disable phone notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    setTestBusy(true);
    setMessage('');

    try {
      const result = await sendTestPushNotification();
      await refreshDiagnostics();
      setMessage(`Test push sent to ${result.sent || 0} device${result.sent === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('[PushNotifications] failed to send test notification:', error);
      await refreshHealth().catch(() => {});
      setMessage(error?.message || 'Unable to send test notification.');
    } finally {
      setTestBusy(false);
    }
  };

  const handleCheckSetup = async () => {
    setDiagnosticBusy(true);
    setMessage('');

    try {
      const nextDiagnostics = await refreshDiagnostics({ ensureRegistration: true });
      setMessage(nextDiagnostics.health?.message || 'Notification setup checked.');
    } catch (error) {
      console.error('[PushNotifications] diagnostics check failed:', error);
      setMessage(error?.message || 'Unable to check notification setup.');
    } finally {
      setDiagnosticBusy(false);
    }
  };

  const handleLocalTest = async () => {
    setDiagnosticBusy(true);
    setMessage('');

    try {
      await sendLocalDiagnosticNotification();
      setMessage('Local test notification shown. This does not prove idle or lock-screen Web Push delivery.');
    } catch (error) {
      console.error('[PushNotifications] local notification test failed:', error);
      setMessage(error?.message || 'Unable to show local test notification.');
    } finally {
      setDiagnosticBusy(false);
    }
  };

  const serviceWorkerStatus = diagnostics?.registration;
  const subscriptionStatus = diagnostics?.subscription;
  const metadata = diagnostics?.metadata;
  const app = diagnostics?.app;
  const isInstalledPwa = status.isStandalone;
  const needsIosInstallHelp = status.isIos && !isInstalledPwa;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-400">Phone notifications</p>
          <p className={`text-xs font-semibold ${enabled ? 'text-emerald-300' : 'text-amber-300'}`}>
            {statusText}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-black text-white transition-colors hover:border-blue-500/60 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={enabled ? handleDisable : handleEnable}
          disabled={(!enabled && !status.canEnable) || busy}
        >
          {enabled ? <BellOff size={14} aria-hidden="true" /> : <BellRing size={14} aria-hidden="true" />}
          {busy ? 'Working...' : enabled ? 'Disable phone notifications' : 'Enable phone notifications'}
        </button>
      </div>

      <div className="space-y-1 text-xs font-medium leading-relaxed text-slate-500">
        <p>Web push uses the OS default notification sound settings. Android browsers may vibrate when supported.</p>
        <p>Focus Mode, Do Not Disturb, Battery Saver, blocked site permissions, or OS notification settings can suppress alerts.</p>
      </div>

      {status.isIos && !status.isStandalone && (
        <p className="text-xs font-semibold text-amber-300">
          To receive iPhone lock-screen notifications, open this site in Safari, tap Share, tap Add to Home Screen, then open the app from the Home Screen icon and tap Enable Notifications.
        </p>
      )}
      {status.isVercelPreview && (
        <p className="text-xs font-semibold text-amber-300">
          Push subscriptions are tied to this exact URL. Delete old preview Home Screen apps and install from ccfbc-lineup-manager-code.vercel.app.
        </p>
      )}

      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleSendTest}
        disabled={testBusy || !enabled}
      >
        <Send size={14} aria-hidden="true" />
        {testBusy ? 'Sending test...' : 'Send test notification'}
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Smartphone size={15} className="shrink-0 text-blue-300" aria-hidden="true" />
            <p className="text-xs font-black text-white">Notification Diagnostics</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            {enabled ? 'Ready' : 'Check'}
          </span>
        </div>

        {needsIosInstallHelp && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-semibold leading-relaxed text-amber-200">
            To receive iPhone lock-screen notifications, open this site in Safari, tap Share, tap Add to Home Screen, then open the app from the Home Screen icon and tap Enable Notifications.
          </p>
        )}

        <dl className="rounded-lg bg-slate-900/70 px-3">
          <DiagnosticRow label="Device type" value={status.isIos ? 'iPhone/iPad' : status.isAndroid ? 'Android' : 'Desktop/other'} />
          <DiagnosticRow label="Running in Safari" value={status.isSafari} tone={status.isIos && status.isSafari ? 'good' : 'slate'} />
          <DiagnosticRow label="Installed PWA" value={isInstalledPwa} tone={isInstalledPwa ? 'good' : status.isIos ? 'warn' : 'slate'} />
          <DiagnosticRow label="navigator.standalone" value={status.navigatorStandalone} />
          <DiagnosticRow label="display-mode standalone" value={status.displayModeStandalone} />
          <DiagnosticRow label="Notification permission" value={status.permission} tone={status.permission === 'granted' ? 'good' : status.permission === 'denied' ? 'warn' : 'slate'} />
          <DiagnosticRow label="Service worker supported" value={status.hasServiceWorker} tone={status.hasServiceWorker ? 'good' : 'warn'} />
          <DiagnosticRow label="Service worker registered" value={serviceWorkerStatus?.registered} tone={serviceWorkerStatus?.registered ? 'good' : 'warn'} />
          <DiagnosticRow label="Service worker active" value={serviceWorkerStatus?.active} tone={serviceWorkerStatus?.active ? 'good' : 'warn'} />
          <DiagnosticRow label="Push supported" value={status.hasPushManager} tone={status.hasPushManager ? 'good' : 'warn'} />
          <DiagnosticRow label="Browser subscription" value={formatEndpoint(subscriptionStatus?.endpoint)} tone={subscriptionStatus?.exists ? 'good' : 'warn'} />
          <DiagnosticRow label="Saved in Supabase" value={subscriptionStatus?.savedInSupabase} tone={subscriptionStatus?.savedInSupabase ? 'good' : 'warn'} />
          <DiagnosticRow label="Last subscription sync" value={metadata?.lastSubscriptionSyncAt} />
          <DiagnosticRow label="Last push received" value={metadata?.lastPushReceivedAt} />
          <DiagnosticRow label="App version" value={app?.version} />
          <DiagnosticRow label="Service worker version" value={app?.serviceWorkerVersion} />
        </dl>

        {subscriptionStatus?.serverError && (
          <p className="mt-2 text-xs font-semibold text-amber-300">{subscriptionStatus.serverError}</p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-black text-white transition-colors hover:border-blue-500/60 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleCheckSetup}
            disabled={diagnosticBusy}
          >
            <ClipboardCheck size={14} aria-hidden="true" />
            {diagnosticBusy ? 'Checking...' : 'Check Notification Setup'}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleResubscribe}
            disabled={busy || !status.canEnable}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Resubscribe This Device
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleLocalTest}
            disabled={diagnosticBusy || !status.hasNotification}
          >
            <Send size={14} aria-hidden="true" />
            Send Test Local Notification
          </button>
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-slate-300">{message}</p>}
    </div>
  );
}
