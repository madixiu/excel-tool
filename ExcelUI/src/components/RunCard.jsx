import Card from "./Card";
import StageDot from "./StageDot";

function SheetPreview({ placement }) {
  const isFront = placement === "front";
  return (
    <div
      className="w-[116px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
      aria-hidden="true"
    >
      <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-100 text-center text-[8px] font-semibold text-slate-500">
        {["A", "B", "C", "D"].map((column) => (
          <span
            key={column}
            className="border-l border-slate-200 py-1 first:border-l-0"
          >
            {column}
          </span>
        ))}
      </div>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="grid grid-cols-4 border-b border-slate-100 last:border-b-0"
        >
          {[0, 1, 2, 3].map((column) => {
            const highlighted = isFront ? column === 0 : column === 3;
            return (
              <span
                key={column}
                className={`h-3 border-l border-slate-100 first:border-l-0 ${highlighted ? "bg-blue-100" : "bg-white"}`}
              />
            );
          })}
        </div>
      ))}
      <div className={`h-1.5 ${isFront ? "bg-blue-500" : "bg-emerald-500"}`} />
    </div>
  );
}

export default function RunCard({
  place,
  setPlace,
  running,
  progress,
  downloadHref,
  canRun,
  onRun,
}) {
  return (
    <Card step="۴" title="اجرا">
      <div className="flex gap-4 mb-5 flex-wrap" dir="ltr">
        <label className="flex min-w-[220px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:border-blue-300 transition-colors">
          <input
            type="radio"
            checked={place === "front"}
            onChange={() => setPlace("front")}
          />
          <SheetPreview placement="front" />
          <span dir="rtl">
            نتیجه در <b>ابتدا</b>
          </span>
        </label>
        <label className="flex min-w-[220px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:border-emerald-300 transition-colors">
          <input
            type="radio"
            checked={place === "back"}
            onChange={() => setPlace("back")}
          />
          <SheetPreview placement="back" />
          <span dir="rtl">
            نتیجه در <b>انتها</b>
          </span>
        </label>
      </div>

      <button
        onClick={onRun}
        disabled={running || !canRun}
        className="px-7 py-3.5 rounded-[10px] text-white font-semibold text-[15px] bg-gradient-to-br from-blue-400 to-indigo-400 disabled:opacity-50 hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        {running ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            {progress.stage || "در حال پردازش…"}
          </>
        ) : (
          <>▶ اجرا</>
        )}
      </button>

      {downloadHref && (
        <a
          href={downloadHref}
          download
          className="inline-block ml-3 px-7 py-3.5 rounded-[10px] text-white font-semibold text-[15px] bg-gradient-to-br from-green-500 to-green-600 no-underline hover:opacity-90 transition-opacity"
        >
          ⬇ دریافت result.xlsx
        </a>
      )}

      {running && (
        <div className="mt-5">
          <div className="flex justify-between items-center text-[13px] mb-2">
            <span className="text-slate-600 font-medium">
              {progress.stage || "در حال پردازش…"}
            </span>
            <span className="text-slate-400 tabular-nums">
              {progress.percent}%
            </span>
          </div>
          <div className="h-2.5 bg-line-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded-full transition-[width] duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-[11px] text-slate-500">
            <StageDot
              label="بارگذاری"
              active={progress.percent >= 0}
              done={progress.percent > 5}
            />
            <StageDot
              label="فرمول‌ها"
              active={progress.percent >= 5}
              done={progress.percent > 30}
            />
            <StageDot
              label="فیلتر"
              active={progress.percent >= 30}
              done={progress.percent > 50}
            />
            <StageDot
              label="خروجی"
              active={progress.percent >= 50}
              done={progress.percent === 100}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
