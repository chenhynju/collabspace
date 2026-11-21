"use client";

export default function PageHeader({
  title,
  description,
  eyebrow = "CollabSpace",
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-slate-200 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 bg-indigo-600" />
            <p className="eyebrow">{eyebrow}</p>
          </div>
          <h1 className="display-title mt-3 text-[2rem] leading-[1.08] text-slate-900 md:text-[2.55rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
