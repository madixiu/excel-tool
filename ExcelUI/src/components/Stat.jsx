export default function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-slate-200">{value}</div>
    </div>
  );
}