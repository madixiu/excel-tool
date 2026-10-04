import React from "react";
import Card from "./Card";
import LetterInput from "./LetterInput";
import { FUNCTIONS } from "../constants";

const iconBtnCls =
  "border border-line-strong rounded-md text-slate-400 cursor-pointer px-2.5 py-1.5 text-xs bg-transparent hover:border-slate-500 hover:text-slate-300 transition-colors";
const addBtnCls =
  "mt-2 border border-dashed border-line-strong rounded-md text-blue-400 cursor-pointer px-3.5 py-2 text-[13px] bg-transparent hover:border-blue-400 transition-colors";

export default function FormulasCard({
  formulas,
  setFormulas,
  activeField,
  setActiveField,
}) {
  const addFormula = () =>
    setFormulas((fs) => [...fs, { name: "", func: "SUMIFS", args: ["", "", ""] }]);

  return (
    <Card
      step="2"
      title="Formulas"
      right={<span className="text-xs text-slate-500 font-mono">NAME = FUNCTION(ARGS)</span>}
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
          setFormulas((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

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
                style={{ width: Math.max(100, (f.func || "FUNCTION").length * 10 + 30) }}
              />
              <span className="text-slate-500 font-mono text-sm">(</span>

              {f.args.map((arg, argIdx) => (
                <React.Fragment key={argIdx}>
                  <LetterInput
                    value={arg}
                    onChange={(v) => updateArg(argIdx, v)}
                    onFocus={() =>
                      setActiveField({ type: "formula", idx: i, field: `arg${argIdx}` })
                    }
                    active={
                      activeField?.type === "formula" &&
                      activeField?.idx === i &&
                      activeField?.field === `arg${argIdx}`
                    }
                  />
                  {argIdx < f.args.length - 1 && (
                    <span className="text-slate-500 font-mono text-sm">,</span>
                  )}
                </React.Fragment>
              ))}

              {expected === -1 && (
                <button onClick={addArg} className={iconBtnCls} title="Add argument">+</button>
              )}

              <span className="text-slate-500 font-mono text-sm">)</span>

              <button
                onClick={() => setFormulas((fs) => fs.filter((_, j) => j !== i))}
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
  );
}