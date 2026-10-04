export default function Card({ step, title, right, children }) {
  return (
    <section className="bg-bg-card border border-line-subtle rounded-2xl p-6 mb-5">
      <div className="flex items-center gap-3 mb-5">
        {step && (
          <div className="w-7 h-7 rounded-lg bg-line-subtle text-blue-400 flex items-center justify-center text-sm font-bold">
            {step}
          </div>
        )}
        <h2 className="m-0 text-[17px] font-semibold text-slate-100">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}