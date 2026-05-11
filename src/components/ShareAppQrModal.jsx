import { Apple, Copy, Download, QrCode, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createQrSvg } from '../utils/qrCode';

export const APP_SHARE_URL = 'https://ccfbc-lineup-manager-code.vercel.app';

export default function ShareAppQrModal({ open, onClose }) {
  const [copyStatus, setCopyStatus] = useState('');
  const qrSvg = useMemo(() => createQrSvg(APP_SHARE_URL), []);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setCopyStatus('');
  }, [open]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_SHARE_URL);
      setCopyStatus('Link copied');
    } catch {
      setCopyStatus('Copy failed');
    }
  };

  const downloadQr = () => {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'line-up-manager-qr.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareApp = async () => {
    if (!canShare) return;

    try {
      await navigator.share({
        title: 'Line Up Manager',
        text: 'Open and install the Line Up Manager app.',
        url: APP_SHARE_URL,
      });
    } catch (error) {
      if (error?.name !== 'AbortError') setCopyStatus('Share unavailable');
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-labelledby="share-app-title">
      <div className="mobile-dialog overflow-y-auto border border-slate-700 bg-slate-900 p-4 shadow-2xl ring-1 ring-white/10 sm:max-w-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-blue-400">Share App QR</p>
            <h2 id="share-app-title" className="mt-1 break-words text-2xl font-black text-white">Share Line Up Manager</h2>
          </div>
          <button className="icon-button shrink-0" type="button" onClick={onClose} aria-label="Close share app QR modal">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[0.9fr_1fr] sm:items-center">
          <div className="rounded-2xl bg-white p-3 shadow-inner">
            <div className="mx-auto aspect-square w-full max-w-64" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-950/60 text-blue-300 ring-1 ring-blue-500/20">
                <QrCode size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-black text-white">Line Up Manager</p>
                <p className="text-sm font-medium leading-relaxed text-slate-400">Scan this QR code to open and install the Line Up Manager app.</p>
              </div>
            </div>

            <a className="mt-4 block break-all rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm font-bold text-blue-300" href={APP_SHARE_URL} target="_blank" rel="noopener noreferrer">
              {APP_SHARE_URL}
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button className="btn-secondary !px-3" type="button" onClick={copyLink}>
            <Copy size={16} aria-hidden="true" /> Copy Link
          </button>
          <button className="btn-secondary !px-3" type="button" onClick={downloadQr}>
            <Download size={16} aria-hidden="true" /> Download QR
          </button>
          {canShare && (
            <button className="btn-primary !px-3" type="button" onClick={shareApp}>
              <Share2 size={16} aria-hidden="true" /> Share App
            </button>
          )}
        </div>

        {copyStatus && <p className="mt-3 text-sm font-bold text-blue-300" role="status">{copyStatus}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Smartphone size={16} aria-hidden="true" /> Android
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">Scan the code, open the app in Chrome, then use Install app or Add to Home screen.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Apple size={16} aria-hidden="true" /> iPhone
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">Scan the code, open in Safari, tap Share, then choose Add to Home Screen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
