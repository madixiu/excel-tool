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
  { name: "SUMIFS", args: 3, hint: "(SUM_COL, MATCH_COL, KEY_COL)" },
  { name: "COUNTIFS", args: 3, hint: "(COL, MATCH_COL, KEY_COL)" },
  { name: "AVGIFS", args: 3, hint: "(SUM_COL, MATCH_COL, KEY_COL)" },
  { name: "SUM", args: 1, hint: "(COL)" },
  { name: "AVG", args: 1, hint: "(COL)" },
  { name: "MIN", args: 1, hint: "(COL)" },
  { name: "MAX", args: 1, hint: "(COL)" },
  { name: "COUNT", args: 1, hint: "(COL)" },
  { name: "STD", args: 1, hint: "(COL)" },
  { name: "VAR", args: 1, hint: "(COL)" },
  { name: "ROWSUM", args: -1, hint: "(COL1, COL2, ...)" },
  { name: "ROWAVG", args: -1, hint: "(COL1, COL2, ...)" },
  { name: "ROWMIN", args: -1, hint: "(COL1, COL2, ...)" },
  { name: "ROWMAX", args: -1, hint: "(COL1, COL2, ...)" },
  { name: "ADD", args: 2, hint: "(A, B)" },
  { name: "SUB", args: 2, hint: "(A, B)" },
  { name: "MUL", args: 2, hint: "(A, B)" },
  { name: "DIV", args: 2, hint: "(A, B)" },
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

  const addLog = (m) => setLogs((prev) => [...prev, m]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogs([]);
    setDownloadHref(null);
    setProgress({ stage: "", percent: 0 });
    addLog(`Uploading ${file.name}…`);
    const { token } = await uploadFile(file);
    setToken(token);
    const data = await inspectFile(token);
    setInfo(data);
    addLog(
      `Loaded ${data.rows.toLocaleString()} rows × ${data.columns} columns`,
    );
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
      <aside className="w-60 bg-bg-deep border-r border-line-subtle px-5 py-7 flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-2xl font-bold text-white mb-3">
            Σ
          </div>
          <div className="text-lg font-bold text-slate-100 leading-tight">
            Excel
            <br />
            Formula Tool
          </div>
        </div>

        <nav className="mt-10 flex flex-col gap-3">
          <div className="text-[13px] text-slate-400 flex items-center gap-2">
            <span className="text-green-400">●</span> Backend connected
          </div>
          {info && (
            <div className="text-[13px] text-slate-400 flex items-center gap-2">
              <span className="text-blue-400">●</span>{" "}
              {info.rows.toLocaleString()} rows loaded
            </div>
          )}
          {info && (
            <div className="text-[13px] text-slate-400 flex items-center gap-2">
              <span className="text-yellow-400">●</span> {info.columns} columns
            </div>
          )}
        </nav>

        <div className="border-t border-line-subtle pt-4 text-xs text-slate-500">
          <div className="flex flex-col">
            <span>Formula Engine · v1.0</span>
            <span className="text-[10px]">Created by IT pak</span>
          </div>
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
            className="px-7 py-3.5 rounded-[10px] text-white font-semibold text-[15px] bg-gradient-to-br from-blue-400 to-indigo-400 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {running ? "Processing…" : "▶  Run"}
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
              <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
                <span>{progress.stage || "Working…"}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 bg-line-subtle rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded transition-[width] duration-300"
                  style={{ width: `${progress.percent}%` }}
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
