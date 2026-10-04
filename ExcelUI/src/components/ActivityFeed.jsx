import { useEffect, useRef } from "react";

// Classify a log line into a rich event
function classify(line) {
  const l = line.toLowerCase();

  if (line.startsWith("❌")) return { icon: "❌", type: "error",   color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" };
  if (line.startsWith("✓") || line.startsWith("✅")) return { icon: "✅", type: "success", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (line.startsWith("⚠")) return { icon: "⚠️", type: "warning", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" };

  if (l.includes("loading file"))   return { icon: "📥", type: "stage",  color: "text-blue-300",  bg: "bg-blue-500/10",   border: "border-blue-500/30" };
  if (l.includes("loaded"))         return { icon: "📊", type: "info",   color: "text-sky-300",   bg: "bg-sky-500/10",    border: "border-sky-500/30" };
  if (l.includes("formula"))        return { icon: "🧮", type: "stage",  color: "text-violet-300",bg: "bg-violet-500/10", border: "border-violet-500/30" };
  if (l.includes("filter"))         return { icon: "🔎", type: "stage",  color: "text-indigo-300",bg: "bg-indigo-500/10", border: "border-indigo-500/30" };
  if (l.includes("export") || l.includes("saving")) return { icon: "📤", type: "stage",  color: "text-fuchsia-300",bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30" };
  if (l.includes("saved"))          return { icon: "💾", type: "success",color: "text-emerald-300",bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (l.includes("sniffed"))        return { icon: "🔍", type: "info",   color: "text-slate-400", bg: "bg-slate-500/10",  border: "border-slate-500/20" };

  // Timing lines "⏱ Something: 1.234s"
  if (line.startsWith("⏱")) {
    const match = line.match(/⏱\s*(.+?):\s*([\d.]+)s/);
    if (match) {
      const [, stage, time] = match;
      return { icon: "⏱", type: "timing", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", stage, time };
    }
    return { icon: "⏱", type: "timing", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30" };
  }

  // Timing summary block
  if (line.startsWith("━") || line.includes("TIMING SUMMARY")) {
    return { icon: "📈", type: "summary", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/30" };
  }

  // Column dropped counts "324,743 → 15,971 rows (308,772 dropped)"
  if (line.includes("→") && line.includes("rows")) {
    return { icon: "🔢", type: "info", color: "text-teal-300", bg: "bg-teal-500/10", border: "border-teal-500/30" };
  }

  // Formula result "res1: 13,657 rows filled"
  if (/^\s*\w+: [\d,]+ rows filled/.test(line)) {
    const match = line.match(/(\w+): ([\d,]+)/);
    return { icon: "✅", type: "result", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", name: match?.[1], count: match?.[2] };
  }

  // Default
  return { icon: "•", type: "plain", color: "text-slate-400", bg: "bg-slate-500/5", border: "border-transparent" };
}

function ActivityItem({ line }) {
  const meta = classify(line);

  // Timing lines render as compact badges
  if (meta.type === "timing" && meta.stage) {
    const time = parseFloat(meta.time);
    const barWidth = Math.min(100, time * 10); // 0.5s → 5%, 10s → 100%
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded border border-cyan-500/20 bg-cyan-500/5">
        <span className="text-base shrink-0">⏱</span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-[11px] text-cyan-200 truncate font-medium">
              {meta.stage}
            </span>
            <span className="text-[10px] text-cyan-400 tabular-nums font-semibold">
              {meta.time}s
            </span>
          </div>
          <div className="h-0.5 bg-cyan-900/40 rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Formula result "res1: 13,657 rows filled"
  if (meta.type === "result") {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded border border-emerald-500/20 bg-emerald-500/5">
        <span className="text-base shrink-0">✅</span>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <span className="text-[11px] text-emerald-200 truncate">
            <span className="font-semibold">{meta.name}</span> computed
          </span>
          <span className="text-[10px] text-emerald-400 tabular-nums font-semibold shrink-0">
            {meta.count} rows
          </span>
        </div>
      </div>
    );
  }

  // Timing summary block (the ━━━ and TOTAL lines)
  if (meta.type === "summary") {
    // Skip the ━ bars entirely — they're just visual separators
    if (line.startsWith("━")) return null;

    // Parse "  Load         4.564s   58.2%  ███████████"
    const m = line.match(/^\s*(\w+)\s+([\d.]+)s\s+([\d.]+)%\s*(.*)$/);
    if (m) {
      const [, stage, time, pct, bar] = m;
      return (
        <div className="flex items-center gap-2 py-1 px-2 rounded bg-slate-800/40 border border-slate-700/40 text-[11px]">
          <span className="text-slate-400 w-20 shrink-0">{stage}</span>
          <span className="text-slate-300 tabular-nums w-14 shrink-0">{time}s</span>
          <span className="text-slate-500 tabular-nums w-12 shrink-0">{pct}%</span>
          <div className="flex-1 h-1.5 bg-slate-700/40 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500"
              style={{ width: `${parseFloat(pct)}%` }}
            />
          </div>
        </div>
      );
    }

    // TOTAL line
    const totalMatch = line.match(/TOTAL\s+([\d.]+)s/);
    if (totalMatch) {
      return (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/30 text-[11px] mt-1">
          <span className="text-blue-300 font-semibold w-20 shrink-0">TOTAL</span>
          <span className="text-white tabular-nums font-bold">
            {totalMatch[1]}s
          </span>
        </div>
      );
    }

    return (
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold pt-2 pb-1">
        {line.replace(/━/g, "").trim()}
      </div>
    );
  }

  // Progress streaming events (from the new progress event)
  if (meta.type === "plain" && line.includes("Exporting")) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded border border-fuchsia-500/20 bg-fuchsia-500/5">
        <span className="text-base shrink-0">📤</span>
        <span className="text-[11px] text-fuchsia-200 truncate">
          {line}
        </span>
      </div>
    );
  }

  // Default row
  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded border ${meta.border} ${meta.bg}`}>
      <span className="text-sm shrink-0 leading-tight">{meta.icon}</span>
      <span className={`text-[11px] leading-relaxed break-words ${meta.color}`}>
        {line.replace(/^[✓✅❌⚠]\s*/, "")}
      </span>
    </div>
  );
}

export default function ActivityFeed({ logs, clearLogs, logRef }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          Activity
        </div>
        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            className="text-slate-500 hover:text-slate-300 text-[10px] px-1.5 py-0.5 rounded hover:bg-slate-700/40 transition-colors"
            title="Clear activity"
          >
            clear
          </button>
        )}
      </div>

      <div
        ref={logRef}
        className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="text-3xl mb-2 opacity-40">⚡</div>
            <div className="text-[11px] text-slate-600 italic">
              No activity yet
            </div>
            <div className="text-[10px] text-slate-700 mt-1">
              Upload a file to begin
            </div>
          </div>
        ) : (
          logs.map((l, i) => <ActivityItem key={i} line={l} />)
        )}
      </div>
    </div>
  );
}