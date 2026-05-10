import { MUSICIAN_FIELDS } from '../utils/constants';

export default function TeamAssignments({ musicians, onChange, readOnly = false }) {
  if (readOnly) {
    const filled = MUSICIAN_FIELDS.filter(([key]) => musicians?.[key]);
    if (!filled.length) return <p className="text-sm text-slate-500">No team assignments yet.</p>;

    return (
      <div className="print-team-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filled.map(([key, label]) => (
          <div key={key} className="print-team-card rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-inner">
            <p className="print-accent text-[10px] font-black uppercase tracking-widest text-blue-400">{label}</p>
            <p className="mt-1 font-bold text-white">{musicians[key]}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MUSICIAN_FIELDS.map(([key, label]) => (
        <label key={key} className="block">
          <span className="label">{label}</span>
          <input
            className="input"
            value={musicians[key] || ''}
            onChange={(event) => onChange(key, event.target.value)}
            placeholder="Name"
          />
        </label>
      ))}
    </div>
  );
}
