export default function LetterInput({ value, onChange, onFocus, active }) {
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