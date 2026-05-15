export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex w-full min-w-0 max-w-full flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full min-w-0 max-w-full sm:w-auto">
        {eyebrow && <p className="text-wrap-anywhere mb-1.5 text-[11px] font-bold uppercase tracking-normal text-blue-400 sm:text-xs sm:tracking-wider">{eyebrow}</p>}
        <h1 className="text-wrap-anywhere text-[clamp(1.5rem,7vw,2rem)] font-black leading-tight text-white sm:text-4xl">{title}</h1>
        {description && <p className="text-wrap-anywhere mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400 sm:mt-2.5 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex w-full min-w-0 flex-col gap-2 pt-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:pt-0 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}
