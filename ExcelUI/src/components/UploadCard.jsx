import Card from "./Card";
import Stat from "./Stat";

export default function UploadCard({ info, uploadProgress, onUpload, onPickLetter }) {
  return (
    <Card step="1" title="Upload file">
      <label className="block py-8 text-center border-2 border-dashed border-line-strong rounded-xl cursor-pointer text-slate-300 hover:border-blue-400 transition-colors">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onUpload}
          className="hidden"
        />
        <div className="text-3xl mb-2">📂</div>
        <div className="font-semibold">Click to choose a file</div>
        <div className="text-[13px] text-slate-500 mt-1">CSV, XLSX, or XLS</div>
      </label>

      {uploadProgress !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
            <span>{uploadProgress < 100 ? "Uploading…" : "Processing…"}</span>
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
            <Stat label="Rows"    value={info.rows.toLocaleString()} />
            <Stat label="Columns" value={info.columns} />
            <Stat label="File"    value={info.filename} />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5 max-h-56 overflow-y-auto p-2 bg-bg-deep rounded-lg border border-line-subtle">
            {info.column_map.map((c) => (
              <button
                key={c.letter}
                onClick={() => onPickLetter(c.letter)}
                title={`Insert ${c.letter} into active field`}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-line-subtle rounded-md text-left text-xs text-slate-200 hover:bg-line-strong transition-colors"
              >
                <span className="bg-line-strong text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono min-w-[26px] text-center">
                  {c.letter}
                </span>
                <span className="truncate text-slate-400">
                  {c.original_header || "(empty)"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}