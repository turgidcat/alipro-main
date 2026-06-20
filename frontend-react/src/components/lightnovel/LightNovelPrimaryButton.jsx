export default function LightNovelPrimaryButton({ 
  children = "进入章节", 
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={[
        "group relative inline-flex h-[46px] min-w-[190px] items-center justify-center overflow-hidden",
        "rounded-full px-7",
        "bg-[#F48DB8] text-white",
        "text-[15px] font-semibold tracking-[0.08em]",
        "shadow-[0_10px_22px_rgba(231,116,166,0.32)]",
        "ring-1 ring-[#F7B9D2]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:bg-[#F27FAF]",
        "hover:shadow-[0_14px_30px_rgba(231,116,166,0.42)]",
        "active:translate-y-0",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD6EB]/80",
        className,
      ].join(" ")}
      {...props}
    >
      {/* 外层奶油高光边 */}
      <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/55" />

      {/* 内层缝线感虚线 */}
      <span className="pointer-events-none absolute inset-[6px] rounded-full border border-dashed border-white/45" />

      {/* 顶部柔和高光 */}
      <span className="pointer-events-none absolute left-6 right-6 top-[5px] h-px rounded-full bg-white/70" />

      {/* 左侧浅粉光斑 */}
      <span className="pointer-events-none absolute left-4 top-1/2 h-8 w-14 -translate-y-1/2 rounded-full bg-white/18 blur-md" />

      {/* 右侧浅粉光斑 */}
      <span className="pointer-events-none absolute -right-4 top-1/2 h-10 w-16 -translate-y-1/2 rounded-full bg-white/14 blur-lg transition-transform duration-300 group-hover:scale-125" />

      {/* 细小装饰点 */}
      <span className="pointer-events-none absolute left-[18px] top-[9px] h-1 w-1 rounded-full bg-white/65" />
      <span className="pointer-events-none absolute right-[18px] bottom-[9px] h-1 w-1 rounded-full bg-white/55" />

      {/* 内容 */}
      <span className="relative z-10 inline-flex items-center justify-center gap-3">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-[20px] w-[20px] text-white"
          aria-hidden="true"
        >
          <path
            d="M12 3.2L14.15 9.05L20 11.2L14.15 13.35L12 19.2L9.85 13.35L4 11.2L9.85 9.05L12 3.2Z"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 4.5L19.7 6.3L21.5 7L19.7 7.7L19 9.5L18.3 7.7L16.5 7L18.3 6.3L19 4.5Z"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="whitespace-nowrap drop-shadow-[0_1px_0_rgba(160,67,116,0.18)]">
          {children}
        </span>
      </span>
    </button>
  );
}
