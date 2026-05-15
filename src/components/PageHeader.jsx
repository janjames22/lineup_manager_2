export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex w-full min-w-0 max-w-full flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full min-w-0 max-w-full sm:w-auto">
        {eyebrow && <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">{eyebrow}</p>}
        <h1 className="break-words text-[clamp(1.75rem,8vw,2.25rem)] font-black leading-tight text-white sm:text-4xl">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-base font-medium text-slate-400 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex w-full min-w-0 flex-col gap-2 pt-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:pt-0 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}
