import React, { useState, useRef, useEffect } from "react";
import { uploadFile, inspectFile, processFile, downloadUrl } from "./api";

const OPS = [
  { v: "==", l: "equals" },
  { v: "!=", l: "not equals" },
  { v: ">", l: ">" },
  { v: ">=", l: ">=" },
  { v: "<", l: "<" },
  { v: "<=", l: "<=" },
  { v: "contains", l: "contains" },
  { v: "starts_with", l: "starts with" },
  { v: "ends_with", l: "ends with" },
  { v: "is_empty", l: "is empty" },
  { v: "is_not_empty", l: "is not empty" },
];

const FUNCTIONS = [
  { name: "SUMIFS", args: 3, hint: "SUMIFS(Amount, Region, RegionLookup)" },
  {
    name: "COUNTIFS",
    args: 3,
    hint: "COUNTIFS(OrderID, Region, RegionLookup)",
  },
  { name: "AVGIFS", args: 3, hint: "AVGIFS(Price, Category, CategoryLookup)" },
  { name: "SUM", args: 1, hint: "SUM(Sales)" },
  { name: "AVG", args: 1, hint: "AVG(Score)" },
  { name: "MIN", args: 1, hint: "MIN(Temperature)" },
  { name: "MAX", args: 1, hint: "MAX(Revenue)" },
  { name: "COUNT", args: 1, hint: "COUNT(Customer)" },
  { name: "STD", args: 1, hint: "STD(Returns)" },
  { name: "VAR", args: 1, hint: "VAR(Returns)" },
  { name: "ROWSUM", args: -1, hint: "ROWSUM(Q1, Q2, Q3, Q4)" },
  { name: "ROWAVG", args: -1, hint: "ROWAVG(Math, Science, English)" },
  { name: "ROWMIN", args: -1, hint: "ROWMIN(PriceA, PriceB, PriceC)" },
  { name: "ROWMAX", args: -1, hint: "ROWMAX(Score1, Score2, Score3)" },
  { name: "ADD", args: 2, hint: "ADD(Price, Tax)" },
  { name: "SUB", args: 2, hint: "SUB(Revenue, Cost)" },
  { name: "MUL", args: 2, hint: "MUL(Quantity, UnitPrice)" },
  { name: "DIV", args: 2, hint: "DIV(Total, Count)" },
];

export default function App() {
  const [token, setToken] = useState(null);
  const [info, setInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [filterRules, setFilterRules] = useState([
    { column: "", op: "==", value: "", connector: "AND" },
  ]);
  const [useRawFilter, setUseRawFilter] = useState(false);
  const [rawFilter, setRawFilter] = useState("");
  const [place, setPlace] = useState("front");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ stage: "", percent: 0 });
  const [downloadHref, setDownloadHref] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const logRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const addLog = (m) => setLogs((prev) => [...prev, m]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset everything
    setLogs([]);
    setDownloadHref(null);
    setProgress({ stage: "", percent: 0 });
    setUploadProgress(0);
    setInfo(null);
    setToken(null);

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    addLog(`Uploading ${file.name} (${sizeMB} MB)…`);

    try {
      const { token } = await uploadFile(file, (pct) => {
        setUploadProgress(pct);
      });

      setUploadProgress(100);
      addLog(`✓ Upload complete`);

      setToken(token);
      addLog("Inspecting columns…");

      const data = await inspectFile(token);
      setInfo(data);
      addLog(
        `✓ Loaded ${data.rows.toLocaleString()} rows × ${data.columns} columns`,
      );
    } catch (err) {
      addLog(`❌ Upload failed: ${err.message}`);
    } finally {
      // Hide the upload bar after a moment
      setTimeout(() => setUploadProgress(null), 800);
    }
  }

  async function handleRun() {
    if (!token) return;

    for (const [i, f] of formulas.entries()) {
      if (!f.name?.trim()) {
        alert(`Formula #${i + 1}: name is required`);
        return;
      }
      if (!f.func?.trim()) {
        alert(`Formula #${i + 1}: pick a function`);
        return;
      }
      if (!f.args?.length || !f.args.every((a) => a?.trim())) {
        alert(`Formula #${i + 1}: all args must be filled`);
        return;
      }
    }

    setLogs([]);
    setDownloadHref(null);
    setProgress({ stage: "Starting", percent: 0 });
    setRunning(true);
    try {
      await processFile({
        token,
        payload: {
          formulas: formulas.map((f) => ({
            name: f.name.trim(),
            func: f.func.trim().toUpperCase(),
            args: f.args.map((a) => a.trim().toUpperCase()),
          })),
          filter_rules: useRawFilter
            ? []
            : filterRules.filter((r) => r.column && r.op),
          filter_expr: useRawFilter ? rawFilter : "",
          place,
        },
        onEvent: ({ type, data }) => {
          if (type === "log") addLog(data.message);
          if (type === "error") addLog(`❌ ${data.message}`);
          if (type === "progress")
            setProgress({ stage: data.stage, percent: data.percent });
          if (type === "done") setDownloadHref(downloadUrl(token));
        },
      });
    } finally {
      setRunning(false);
    }
  }

  const updateRule = (i, patch) =>
    setFilterRules((rs) =>
      rs.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  const removeRule = (i) =>
    setFilterRules((rs) => rs.filter((_, j) => j !== i));
  const addRule = () =>
    setFilterRules((rs) => [
      ...rs,
      { column: "", op: "==", value: "", connector: "AND" },
    ]);
  const addFormula = () =>
    setFormulas((fs) => [
      ...fs,
      { name: "", func: "SUMIFS", args: ["", "", ""] },
    ]);

  const pickLetter = (letter) => {
    if (!activeField) return;
    if (activeField.type === "formula") {
      const { idx, field } = activeField;
      if (field.startsWith("arg")) {
        const argIdx = parseInt(field.slice(3), 10);
        setFormulas((fs) =>
          fs.map((x, j) => {
            if (j !== idx) return x;
            const args = [...x.args];
            args[argIdx] = letter;
            return { ...x, args };
          }),
        );
      }
    } else if (activeField.type === "filter") {
      updateRule(activeField.idx, { column: letter });
    }
    setActiveField(null);
  };

  return (
    <div className="flex min-h-screen bg-bg-base text-slate-200">
      <datalist id="function-list">
        {FUNCTIONS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.hint}
          </option>
        ))}
      </datalist>

      {/* ---------- SIDEBAR ---------- */}
      <aside className="w-72 bg-bg-deep border-r border-line-subtle px-4 py-6 flex flex-col gap-4">
        {/* ---------- LOG (top) ---------- */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold flex justify-between items-center">
            <span>Activity</span>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-slate-500 hover:text-slate-300 text-[10px]"
                title="Clear log"
              >
                clear
              </button>
            )}
          </div>

          <pre
            ref={logRef}
            className="flex-1 min-h-0 bg-bg-card/60 border border-line-subtle rounded-lg p-2.5 text-[11px] font-mono text-green-300 overflow-y-auto m-0 leading-relaxed whitespace-pre-wrap break-words"
          >
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">No activity yet.</span>
            ) : (
              logs.map((l, i) => (
                <div
                  key={i}
                  className={l.startsWith("❌") ? "text-red-400" : ""}
                >
                  {l}
                </div>
              ))
            )}
          </pre>
        </div>

        {/* ---------- ENGINE STATUS ---------- */}
        <div className="rounded-lg bg-bg-card/60 border border-line-subtle p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
            Engine
          </div>
          <StatusRow color="green" label="Backend" value="Connected" pulse />
          <StatusRow color="blue" label="Throughput" value="14k rows/s" />
          <StatusRow color="violet" label="Latency" value="Instant" />
        </div>

        {/* ---------- FILE ---------- */}
        {info && (
          <div className="rounded-lg bg-bg-card/60 border border-line-subtle p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
              File
            </div>
            <StatusRow
              color="amber"
              label="Rows"
              value={info.rows.toLocaleString()}
            />
            <StatusRow color="amber" label="Columns" value={info.columns} />
          </div>
        )}

        {/* ---------- FOOTER ---------- */}
        <div className="border-t border-line-subtle pt-3 text-xs text-slate-500 mt-auto">
          <span>Formula Engine · v1.0</span>
          <div className="text-[10px]">Created by IT pak</div>
        </div>
      </aside>

      {/* ---------- MAIN ---------- */}
      <main className="flex-1 px-14 py-10  max-h-screen overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-slate-100 tracking-tight">
            Process Excel files with formulas
          </h1>
          <p className="text-slate-400 mt-1.5 text-[15px]">
            Upload a file, define formulas and filters, download the result.
          </p>
        </header>

        {/* Upload */}
        <Card step="1" title="Upload file">
          <label className="block py-8 text-center border-2 border-dashed border-line-strong rounded-xl cursor-pointer text-slate-300 hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
            />
            <div className="text-3xl mb-2">📂</div>
            <div className="font-semibold">Click to choose a file</div>
            <div className="text-[13px] text-slate-500 mt-1">
              CSV, XLSX, or XLS
            </div>
          </label>
          {uploadProgress !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
                <span>
                  {uploadProgress < 100 ? "Uploading…" : "Processing…"}
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
                <Stat label="Rows" value={info.rows.toLocaleString()} />
                <Stat label="Columns" value={info.columns} />
                <Stat label="File" value={info.filename} />
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5 max-h-56 overflow-y-auto p-2 bg-bg-deep rounded-lg border border-line-subtle">
                {info.column_map.map((c) => (
                  <button
                    key={c.letter}
                    onClick={() => pickLetter(c.letter)}
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

        {/* Formulas */}
        <Card
          step="2"
          title="Formulas"
          right={
            <span className="text-xs text-slate-500 font-mono">
              NAME = FUNCTION(ARGS)
            </span>
          }
        >
          {formulas.length === 0 && (
            <div className="p-5 text-center text-slate-500 italic text-sm">
              No formulas yet. Click below to add one.
            </div>
          )}

          {formulas.map((f, i) => {
            const meta = FUNCTIONS.find((x) => x.name === f.func);
            const expected = meta?.args ?? -1;
            const hint = meta?.hint ?? "(custom)";
            const argMismatch = expected !== -1 && f.args.length !== expected;

            const update = (patch) =>
              setFormulas((fs) =>
                fs.map((x, j) => (j === i ? { ...x, ...patch } : x)),
              );

            const changeFunc = (newFunc) => {
              const m = FUNCTIONS.find((x) => x.name === newFunc);
              let args = [...f.args];
              if (m && m.args !== -1) {
                while (args.length < m.args) args.push("");
                args = args.slice(0, m.args);
              }
              update({ func: newFunc, args });
            };

            const updateArg = (argIdx, val) => {
              const args = [...f.args];
              args[argIdx] = val.toUpperCase();
              update({ args });
            };

            const addArg = () => update({ args: [...f.args, ""] });

            return (
              <div
                key={i}
                className="mb-4 pb-3.5 border-b border-dashed border-line-subtle last:border-0"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    value={f.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="Output name"
                    className="flex-[2] bg-bg-deep border border-line-strong rounded-md px-3 py-2 text-slate-100 text-sm outline-none focus:border-blue-400"
                  />

                  <span className="text-slate-500 px-1">=</span>

                  <input
                    list="function-list"
                    value={f.func}
                    onChange={(e) => changeFunc(e.target.value.toUpperCase())}
                    placeholder="FUNCTION"
                    spellCheck={false}
                    className="bg-bg-deep border border-line-strong rounded-md px-3 py-2 text-violet-400 text-sm font-mono font-semibold text-center outline-none focus:border-blue-400"
                    style={{
                      width: Math.max(
                        100,
                        (f.func || "FUNCTION").length * 10 + 30,
                      ),
                    }}
                  />

                  <span className="text-slate-500 font-mono text-sm">(</span>

                  {f.args.map((arg, argIdx) => (
                    <React.Fragment key={argIdx}>
                      <LetterInput
                        value={arg}
                        onChange={(v) => updateArg(argIdx, v)}
                        onFocus={() =>
                          setActiveField({
                            type: "formula",
                            idx: i,
                            field: `arg${argIdx}`,
                          })
                        }
                        active={
                          activeField?.type === "formula" &&
                          activeField?.idx === i &&
                          activeField?.field === `arg${argIdx}`
                        }
                      />
                      {argIdx < f.args.length - 1 && (
                        <span className="text-slate-500 font-mono text-sm">
                          ,
                        </span>
                      )}
                    </React.Fragment>
                  ))}

                  {expected === -1 && (
                    <button
                      onClick={addArg}
                      className={iconBtnCls}
                      title="Add argument"
                    >
                      +
                    </button>
                  )}

                  <span className="text-slate-500 font-mono text-sm">)</span>

                  <button
                    onClick={() =>
                      setFormulas((fs) => fs.filter((_, j) => j !== i))
                    }
                    className={iconBtnCls}
                    title="Remove formula"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs text-slate-500 mt-1.5 font-mono pl-1">
                  {hint}
                  {argMismatch && (
                    <span className="text-red-400 ml-3">
                      ⚠ Expected {expected} args, got {f.args.length}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={addFormula} className={addBtnCls}>
            + Add formula
          </button>
        </Card>

        {/* Filters */}
        <Card
          step="3"
          title="Filters"
          right={
            <label className="ml-auto flex items-center gap-1.5 text-[13px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={useRawFilter}
                onChange={(e) => setUseRawFilter(e.target.checked)}
              />
              Raw SQL
            </label>
          }
        >
          {!useRawFilter ? (
            <>
              {filterRules.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 mb-2.5 flex-wrap"
                >
                  <LetterInput
                    value={r.column}
                    onChange={(v) => updateRule(i, { column: v.toUpperCase() })}
                    onFocus={() => setActiveField({ type: "filter", idx: i })}
                    active={
                      activeField?.type === "filter" && activeField?.idx === i
                    }
                  />
                  <select
                    value={r.op}
                    onChange={(e) => updateRule(i, { op: e.target.value })}
                    className="bg-bg-deep border border-line-strong rounded-md px-2.5 py-2 text-slate-100 text-sm outline-none min-w-[110px] focus:border-blue-400"
                  >
                    {OPS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                  <input
                    value={r.value}
                    onChange={(e) => updateRule(i, { value: e.target.value })}
                    placeholder="value"
                    disabled={["is_empty", "is_not_empty"].includes(r.op)}
                    className={`flex-1 bg-bg-deep border border-line-strong rounded-md px-3 py-2 text-slate-100 text-sm outline-none focus:border-blue-400 ${
                      ["is_empty", "is_not_empty"].includes(r.op)
                        ? "opacity-40"
                        : ""
                    }`}
                  />
                  {i < filterRules.length - 1 ? (
                    <select
                      value={r.connector}
                      onChange={(e) =>
                        updateRule(i, { connector: e.target.value })
                      }
                      className="bg-bg-deep border border-line-strong rounded-md px-2.5 py-2 text-slate-100 text-sm outline-none w-20 focus:border-blue-400"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  ) : (
                    <span className="w-20" />
                  )}
                  <button onClick={() => removeRule(i)} className={iconBtnCls}>
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addRule} className={addBtnCls}>
                + Add filter rule
              </button>
            </>
          ) : (
            <input
              value={rawFilter}
              onChange={(e) => setRawFilter(e.target.value)}
              placeholder="AC != '-' AND TRIM(AC) != ''"
              className="w-full bg-bg-deep border border-line-strong rounded-md px-3 py-2 text-slate-100 text-sm font-mono outline-none focus:border-blue-400"
            />
          )}
        </Card>

        {/* Run */}
        <Card step="4" title="Run">
          <div className="flex gap-6 mb-5 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="radio"
                checked={place === "front"}
                onChange={() => setPlace("front")}
              />
              Results at <b>front</b>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="radio"
                checked={place === "back"}
                onChange={() => setPlace("back")}
              />
              Results at <b>back</b>
            </label>
          </div>

          <button
            onClick={handleRun}
            disabled={running || !token}
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
                <span className="text-slate-300 font-medium">
                  {progress.stage || "Working…"}
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
                  label="Load"
                  active={progress.percent >= 0}
                  done={progress.percent > 5}
                />
                <StageDot
                  label="Formulas"
                  active={progress.percent >= 5}
                  done={progress.percent > 30}
                />
                <StageDot
                  label="Filter"
                  active={progress.percent >= 30}
                  done={progress.percent > 50}
                />
                <StageDot
                  label="Export"
                  active={progress.percent >= 50}
                  done={progress.percent === 100}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Log */}
        {logs.length > 0 && (
          <Card
            title="Log"
            right={
              <button
                onClick={() => setLogs([])}
                className={iconBtnCls}
                title="Clear log"
              >
                ✕
              </button>
            }
          >
            <pre
              ref={logRef}
              className="bg-bg-deep border border-line-subtle rounded-lg p-4 text-[13px] font-mono text-green-300 max-h-80 overflow-y-auto m-0 leading-relaxed"
            >
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={l.startsWith("❌") ? "text-red-400" : ""}
                >
                  {l}
                </div>
              ))}
            </pre>
          </Card>
        )}
      </main>
    </div>
  );
}

/* ---------- Reusable ---------- */
const iconBtnCls =
  "border border-line-strong rounded-md text-slate-400 cursor-pointer px-2.5 py-1.5 text-xs bg-transparent hover:border-slate-500 hover:text-slate-300 transition-colors";
const addBtnCls =
  "mt-2 border border-dashed border-line-strong rounded-md text-blue-400 cursor-pointer px-3.5 py-2 text-[13px] bg-transparent hover:border-blue-400 transition-colors";

function Card({ step, title, right, children }) {
  return (
    <section className="bg-bg-card border border-line-subtle rounded-2xl p-6 mb-5">
      <div className="flex items-center gap-3 mb-5">
        {step && (
          <div className="w-7 h-7 rounded-lg bg-line-subtle text-blue-400 flex items-center justify-center text-sm font-bold">
            {step}
          </div>
        )}
        <h2 className="m-0 text-[17px] font-semibold text-slate-100">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function LetterInput({ value, onChange, onFocus, active }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      maxLength={3}
      className={`bg-bg-deep border border-line-strong rounded-md py-2 text-blue-400 text-sm font-bold text-center w-[54px] font-mono outline-none transition-shadow ${
        active
          ? "border-blue-400 shadow-[0_0_0_4px_rgba(96,165,250,0.15)]"
          : "focus:border-blue-400"
      }`}
    />
  );
}

function StatusRow({ color, label, value, pulse = false }) {
  const colorMap = {
    green: "bg-green-400",
    blue: "bg-blue-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <div className="flex items-center gap-2 text-slate-400">
        <span className={`relative flex h-1.5 w-1.5`}>
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${colorMap[color]} opacity-60 animate-ping`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${colorMap[color]}`}
          />
        </span>
        {label}
      </div>
      <span className="text-slate-200 font-medium tabular-nums">{value}</span>
    </div>
  );
}

function StageDot({ label, active, done }) {
  const dot = done ? "bg-green-400" : active ? "bg-blue-400" : "bg-line-strong";
  const text = done || active ? "text-slate-300" : "text-slate-500";
  return (
    <div className={`flex items-center gap-1.5 ${text}`}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${dot} transition-colors`}
      />
      {label}
    </div>
  );
}
