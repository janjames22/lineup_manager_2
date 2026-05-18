export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex w-full min-w-0 max-w-full flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full min-w-0 max-w-full sm:w-auto">
        {eyebrow && <p className="text-wrap-anywhere mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-blue-400/80 sm:text-[11px]">{eyebrow}</p>}
        <h1 className="text-wrap-anywhere text-[clamp(1.4rem,6vw,1.875rem)] font-black leading-[1.1] tracking-tight text-white sm:text-[2rem]">{title}</h1>
        {description && <p className="text-wrap-anywhere mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400/90 sm:mt-2.5 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="grid w-full min-w-0 grid-cols-1 gap-2 pt-1 sm:w-auto sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:pt-0 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}
