export default function StatusRow({ color, label, value, pulse = false }) {
  const colorMap = {
    green:  "bg-green-400",
    blue:   "bg-blue-400",
    violet: "bg-violet-400",
    amber:  "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${colorMap[color]} opacity-60 animate-ping`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${colorMap[color]}`} />
        </span>
        {label}
      </div>
      <span className="text-slate-200 font-medium tabular-nums">{value}</span>
    </div>
  );
}