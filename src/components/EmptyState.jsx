import { FileQuestion } from 'lucide-react';

export default function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/20 p-6 text-center transition hover:border-slate-700 sm:rounded-[2.5rem] sm:p-12">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-slate-800 text-slate-500 shadow-inner ring-1 ring-white/10 sm:mb-6 sm:size-20 sm:rounded-3xl">
        <FileQuestion size={32} strokeWidth={1.5} className="sm:size-10" />
      </div>
      <h2 className="text-wrap-anywhere text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
      <p className="text-wrap-anywhere mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-400 sm:mt-3 sm:text-base">{message}</p>
      {action && <div className="mt-5 w-full sm:mt-8 sm:w-auto">{action}</div>}
    </div>
  );
}
