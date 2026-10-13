import StatusRow from "./StatusRow";
import ActivityFeed from "./ActivityFeed";

export default function Sidebar({ logs, clearLogs, logRef, info, progress }) {
  const showLiveRate = progress?.rate > 0 && progress?.stage === "Export";
  const throughputValue = showLiveRate
    ? `${Math.round(progress.rate / 1000)} هزار ردیف/ثانیه`
    : "۱۴هزار ردیف/ثانیه";

  return (
    <aside className="w-72 bg-bg-deep border-l border-line-subtle px-4 py-6 flex flex-col gap-4">
      {/* ACTIVITY FEED (replaces old text log) */}
      <ActivityFeed logs={logs} clearLogs={clearLogs} logRef={logRef} />

      {/* ENGINE */}
      <div className="rounded-lg bg-bg-card/60 border border-line-subtle p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
          موتور پردازش
        </div>
        <StatusRow color="green" label="سرویس پشتیبان" value="متصل" pulse />
        <StatusRow
          color={showLiveRate ? "violet" : "blue"}
          label="سرعت پردازش"
          value={throughputValue}
          pulse={showLiveRate}
        />
        <StatusRow color="blue" label="تاخیر" value="لحظه‌ای" />

        {showLiveRate && progress.total > 0 && (
          <div className="mt-2 pt-2 border-t border-line-subtle">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>در حال نوشتن ردیف‌ها</span>
              <span className="tabular-nums">
                {progress.current.toLocaleString()} /{" "}
                {progress.total.toLocaleString()}
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
            فایل
          </div>
          <StatusRow
            color="amber"
            label="Rows"
            value={info.rows.toLocaleString()}
          />
          <StatusRow color="amber" label="Columns" value={info.columns} />
        </div>
      )}

      {/* FOOTER */}
      <div className="border-t border-line-subtle pt-3 text-xs text-slate-500 mt-auto">
        <span>موتور فرمول · نسخه ۱.۰</span>
        <div className="text-[10px]">ساخته‌شده توسط IT pak</div>
      </div>
    </aside>
  );
}
