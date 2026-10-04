import Card from "./Card";
import LetterInput from "./LetterInput";
import { OPS } from "../constants";

const iconBtnCls =
  "border border-line-strong rounded-md text-slate-400 cursor-pointer px-2.5 py-1.5 text-xs bg-transparent hover:border-slate-500 hover:text-slate-300 transition-colors";
const addBtnCls =
  "mt-2 border border-dashed border-line-strong rounded-md text-blue-400 cursor-pointer px-3.5 py-2 text-[13px] bg-transparent hover:border-blue-400 transition-colors";

export default function FiltersCard({
  filterRules,
  setFilterRules,
  useRawFilter,
  setUseRawFilter,
  rawFilter,
  setRawFilter,
  activeField,
  setActiveField,
}) {
  const updateRule = (i, patch) =>
    setFilterRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRule = (i) => setFilterRules((rs) => rs.filter((_, j) => j !== i));
  const addRule = () =>
    setFilterRules((rs) => [
      ...rs,
      { column: "", op: "==", value: "", connector: "AND" },
    ]);

  return (
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
            <div key={i} className="flex items-center gap-2 mb-2.5 flex-wrap">
              <LetterInput
                value={r.column}
                onChange={(v) => updateRule(i, { column: v.toUpperCase() })}
                onFocus={() => setActiveField({ type: "filter", idx: i })}
                active={activeField?.type === "filter" && activeField?.idx === i}
              />
              <select
                value={r.op}
                onChange={(e) => updateRule(i, { op: e.target.value })}
                className="bg-bg-deep border border-line-strong rounded-md px-2.5 py-2 text-slate-100 text-sm outline-none min-w-[110px] focus:border-blue-400"
              >
                {OPS.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
              <input
                value={r.value}
                onChange={(e) => updateRule(i, { value: e.target.value })}
                placeholder="value"
                disabled={["is_empty", "is_not_empty"].includes(r.op)}
                className={`flex-1 bg-bg-deep border border-line-strong rounded-md px-3 py-2 text-slate-100 text-sm outline-none focus:border-blue-400 ${
                  ["is_empty", "is_not_empty"].includes(r.op) ? "opacity-40" : ""
                }`}
              />
              {i < filterRules.length - 1 ? (
                <select
                  value={r.connector}
                  onChange={(e) => updateRule(i, { connector: e.target.value })}
                  className="bg-bg-deep border border-line-strong rounded-md px-2.5 py-2 text-slate-100 text-sm outline-none w-20 focus:border-blue-400"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              ) : (
                <span className="w-20" />
              )}
              <button onClick={() => removeRule(i)} className={iconBtnCls}>✕</button>
            </div>
          ))}
          <button onClick={addRule} className={addBtnCls}>+ Add filter rule</button>
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
  );
}