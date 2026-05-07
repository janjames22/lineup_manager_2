import { FileQuestion } from 'lucide-react';

export default function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-800 bg-slate-900/20 p-12 text-center transition hover:border-slate-700">
      <div className="mb-6 grid size-20 place-items-center rounded-3xl bg-slate-800 text-slate-500 shadow-inner ring-1 ring-white/10">
        <FileQuestion size={40} strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-base font-medium text-slate-400 leading-relaxed">{message}</p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
