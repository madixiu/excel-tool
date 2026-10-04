export default function StageDot({ label, active, done }) {
  const dot = done ? "bg-green-400" : active ? "bg-blue-400" : "bg-line-strong";
  const text = done || active ? "text-slate-300" : "text-slate-500";
  return (
    <div className={`flex items-center gap-1.5 ${text}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot} transition-colors`} />
      {label}
    </div>
  );
}