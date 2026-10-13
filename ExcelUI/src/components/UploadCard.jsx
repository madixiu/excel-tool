import Card from "./Card";
import Stat from "./Stat";

export default function UploadCard({
  info,
  uploadProgress,
  onUpload,
  onPickLetter,
}) {
  return (
    <Card step="۱" title="بارگذاری فایل">
      <label className="block py-8 text-center border-2 border-dashed border-line-strong rounded-xl cursor-pointer text-slate-600 hover:border-blue-400 transition-colors">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onUpload}
          className="hidden"
        />
        <div className="text-3xl mb-2">📂</div>
        <div className="font-semibold">برای انتخاب فایل کلیک کنید</div>
        <div className="text-[13px] text-slate-500 mt-1">CSV، XLSX یا XLS</div>
      </label>

      {uploadProgress !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
            <span>
              {uploadProgress < 100 ? "در حال بارگذاری…" : "در حال پردازش…"}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-line-subtle rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded transition-[width] duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {info && (
        <div className="mt-4">
          <div className="flex gap-6 mb-3">
            <Stat label="ردیف" value={info.rows.toLocaleString()} />
            <Stat label="ستون" value={info.columns} />
            <Stat label="فایل" value={info.filename} />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5 max-h-56 overflow-y-auto p-2 bg-bg-deep rounded-lg border border-line-subtle">
            {info.column_map.map((c) => (
              <button
                key={c.letter}
                onClick={() => onPickLetter(c.letter)}
                title={`درج ${c.letter} در فیلد فعال`}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-line-subtle rounded-md text-right text-xs text-slate-700 hover:bg-line-strong transition-colors"
              >
                <span className="bg-line-strong text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono min-w-[26px] text-center">
                  {c.letter}
                </span>
                <span className="truncate text-slate-400">
                  {c.original_header || "(خالی)"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
