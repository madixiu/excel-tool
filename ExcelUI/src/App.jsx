import { useState, useRef, useEffect } from "react";
import { uploadFile, inspectFile, processFile, downloadUrl } from "./api";
import { FUNCTIONS } from "./constants";

import Sidebar from "./components/Sidebar";
import UploadCard from "./components/UploadCard";
import FormulasCard from "./components/FormulasCard";
import FiltersCard from "./components/FiltersCard";
import RunCard from "./components/RunCard";

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
  const [progress, setProgress] = useState({
    stage: "",
    percent: 0,
    current: 0,
    total: 0,
    rate: 0,
  });
  const [downloadHref, setDownloadHref] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const logRef = useRef(null);

  const addLog = (m) => setLogs((prev) => [...prev, m]);
  const clearLogs = () => setLogs([]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogs([]);
    setDownloadHref(null);
    setProgress({ stage: "", percent: 0 });
    setUploadProgress(0);
    setInfo(null);
    setToken(null);

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    addLog(`در حال بارگذاری ${file.name} (${sizeMB} مگابایت)…`);

    try {
      const { token } = await uploadFile(file, (pct) => setUploadProgress(pct));
      setUploadProgress(100);
      addLog(`✓ بارگذاری با موفقیت انجام شد`);
      setToken(token);
      addLog("در حال بررسی ستون‌ها…");
      const data = await inspectFile(token);
      setInfo(data);
      addLog(
        `✓ ${data.rows.toLocaleString()} ردیف و ${data.columns} ستون بارگذاری شد`,
      );
    } catch (err) {
      addLog(`❌ بارگذاری ناموفق بود: ${err.message}`);
    } finally {
      setTimeout(() => setUploadProgress(null), 800);
    }
  }

  async function handleRun() {
    if (!token) return;

    for (const [i, f] of formulas.entries()) {
      if (!f.name?.trim()) {
        alert(`فرمول شماره ${i + 1}: نام خروجی الزامی است`);
        return;
      }
      if (!f.func?.trim()) {
        alert(`فرمول شماره ${i + 1}: یک تابع انتخاب کنید`);
        return;
      }
      if (!f.args?.length || !f.args.every((a) => a?.trim())) {
        alert(`فرمول شماره ${i + 1}: همه آرگومان‌ها را وارد کنید`);
        return;
      }
    }

    setLogs([]);
    setDownloadHref(null);
    setProgress({ stage: "شروع", percent: 0 });
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
          if (type === "progress") {
            setProgress({
              stage: data.stage,
              percent:
                data.percent ?? Math.round((data.current / data.total) * 100),
              current: data.current,
              total: data.total,
              rate: data.rate,
            });
          }
          if (type === "done") setDownloadHref(downloadUrl(token));
        },
      });
    } finally {
      setRunning(false);
    }
  }

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
      setFilterRules((rs) =>
        rs.map((r, j) =>
          j === activeField.idx ? { ...r, column: letter } : r,
        ),
      );
    }
    setActiveField(null);
  };

  return (
    <div className="flex min-h-screen bg-bg-base text-slate-700" dir="rtl">
      <datalist id="function-list">
        {FUNCTIONS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.hint}
          </option>
        ))}
      </datalist>

      <Sidebar
        logs={logs}
        clearLogs={clearLogs}
        logRef={logRef}
        info={info}
        progress={progress}
      />

      <main className="flex-1 px-14 py-10 max-h-screen overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">
            پردازش فایل‌های اکسل با فرمول
          </h1>
          <p className="text-slate-500 mt-1.5 text-[15px]">
            فایل را بارگذاری کنید، فرمول‌ها و فیلترها را تعیین کنید و نتیجه را
            دریافت کنید.
          </p>
        </header>

        <UploadCard
          info={info}
          uploadProgress={uploadProgress}
          onUpload={handleUpload}
          onPickLetter={pickLetter}
        />
        <FormulasCard
          formulas={formulas}
          setFormulas={setFormulas}
          activeField={activeField}
          setActiveField={setActiveField}
        />
        <FiltersCard
          filterRules={filterRules}
          setFilterRules={setFilterRules}
          useRawFilter={useRawFilter}
          setUseRawFilter={setUseRawFilter}
          rawFilter={rawFilter}
          setRawFilter={setRawFilter}
          activeField={activeField}
          setActiveField={setActiveField}
        />
        <RunCard
          place={place}
          setPlace={setPlace}
          running={running}
          progress={progress}
          downloadHref={downloadHref}
          canRun={!!token}
          onRun={handleRun}
        />
      </main>
    </div>
  );
}
