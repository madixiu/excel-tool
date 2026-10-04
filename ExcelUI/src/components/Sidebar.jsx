import StatusRow from "./StatusRow";
import ActivityFeed from "./ActivityFeed";

export default function Sidebar({ logs, clearLogs, logRef, info, progress }) {
  const showLiveRate = progress?.rate > 0 && progress?.stage === "Export";
  const throughputValue = showLiveRate
    ? `${Math.round(progress.rate / 1000)}k rows/s`
    : "14k rows/s";

  return (
    <aside className="w-72 bg-bg-deep border-r border-line-subtle px-4 py-6 flex flex-col gap-4">
      {/* ACTIVITY FEED (replaces old text log) */}
      <ActivityFeed logs={logs} clearLogs={clearLogs} logRef={logRef} />

      {/* ENGINE */}
      <div className="rounded-lg bg-bg-card/60 border border-line-subtle p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
          Engine
        </div>
        <StatusRow color="green"  label="Backend"    value="Connected" pulse />
        <StatusRow
          color={showLiveRate ? "violet" : "blue"}
          label="Throughput"
          value={throughputValue}
          pulse={showLiveRate}
        />
        <StatusRow color="blue"   label="Latency"    value="Instant" />

        {showLiveRate && progress.total > 0 && (
          <div className="mt-2 pt-2 border-t border-line-subtle">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Writing rows</span>
              <span className="tabular-nums">
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
              </span>
            </div>
            <div className="h-1 bg-line-subtle rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-violet-400 transition-[width] duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* FILE */}
      {info && (
        <div className="rounded-lg bg-bg-card/60 border border-line-subtle p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
            File
          </div>
          <StatusRow color="amber" label="Rows"    value={info.rows.toLocaleString()} />
          <StatusRow color="amber" label="Columns" value={info.columns} />
        </div>
      )}

      {/* FOOTER */}
      <div className="border-t border-line-subtle pt-3 text-xs text-slate-500 mt-auto">
        <span>Formula Engine · v1.0</span>
        <div className="text-[10px]">Created by IT pak</div>
      </div>
    </aside>
  );
}