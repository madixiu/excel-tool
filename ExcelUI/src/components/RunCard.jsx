import Card from "./Card";
import StageDot from "./StageDot";

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
    <Card step="4" title="Run">
      <div className="flex gap-6 mb-5 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="radio" checked={place === "front"} onChange={() => setPlace("front")} />
          Results at <b>front</b>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="radio" checked={place === "back"} onChange={() => setPlace("back")} />
          Results at <b>back</b>
        </label>
      </div>

      <button
        onClick={onRun}
        disabled={running || !canRun}
        className="px-7 py-3.5 rounded-[10px] text-white font-semibold text-[15px] bg-gradient-to-br from-blue-400 to-indigo-400 disabled:opacity-50 hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        {running ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {progress.stage || "Working…"}
          </>
        ) : (
          <>▶ Run</>
        )}
      </button>

      {downloadHref && (
        <a
          href={downloadHref}
          download
          className="inline-block ml-3 px-7 py-3.5 rounded-[10px] text-white font-semibold text-[15px] bg-gradient-to-br from-green-500 to-green-600 no-underline hover:opacity-90 transition-opacity"
        >
          ⬇ Download result.xlsx
        </a>
      )}

      {running && (
        <div className="mt-5">
          <div className="flex justify-between items-center text-[13px] mb-2">
            <span className="text-slate-300 font-medium">{progress.stage || "Working…"}</span>
            <span className="text-slate-400 tabular-nums">{progress.percent}%</span>
          </div>
          <div className="h-2.5 bg-line-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded-full transition-[width] duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-[11px] text-slate-500">
            <StageDot label="Load"     active={progress.percent >= 0}  done={progress.percent > 5} />
            <StageDot label="Formulas" active={progress.percent >= 5}  done={progress.percent > 30} />
            <StageDot label="Filter"   active={progress.percent >= 30} done={progress.percent > 50} />
            <StageDot label="Export"   active={progress.percent >= 50} done={progress.percent === 100} />
          </div>
        </div>
      )}
    </Card>
  );
}