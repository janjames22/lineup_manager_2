export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">{eyebrow}</p>}
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-base font-medium text-slate-400 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:pt-0 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}
