import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="fixed inset-x-0 top-0 z-[1000] flex flex-col items-center gap-2 p-4 pointer-events-none sm:top-auto sm:bottom-0 sm:right-0 sm:left-auto sm:items-end">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }) {
  const { message, type } = toast;
  
  const icons = {
    success: <CheckCircle2 className="text-emerald-400" size={18} />,
    error: <AlertCircle className="text-red-400" size={18} />,
    info: <Info className="text-blue-400" size={18} />,
  };

  const colors = {
    success: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-50',
    error: 'border-red-500/30 bg-red-950/20 text-red-50',
    info: 'border-blue-500/30 bg-blue-950/20 text-blue-50',
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl animate-slide-up sm:animate-slide-in-right min-w-[280px] max-w-md ${colors[type]}`}>
      <div className="shrink-0">{icons[type]}</div>
      <p className="flex-1 text-sm font-black tracking-tight">{message}</p>
    </div>
  );
}
