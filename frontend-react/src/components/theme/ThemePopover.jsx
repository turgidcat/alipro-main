import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyThemePopoverSettings,
  getStoredThemePopoverSettings,
  saveThemePopoverSettings
} from '../../styleTheme.js';

const MODE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

const WARMTH_OPTIONS = [
  { value: 'soft', label: 'Soft' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' }
];

const PROSE_FONT_OPTIONS = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' }
];

function optionButtonClass(active) {
  return [
    'rounded-[10px] border px-2.5 py-1.5 text-[12px] font-medium transition',
    active
      ? 'border-[color:var(--brand-soft-strong)] bg-[color:var(--brand-soft)] text-[color:var(--brand-deep)]'
      : 'border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--panel-strong)_90%,transparent)] text-[color:var(--muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)]'
  ].join(' ');
}

function ThemeControlGroup({ label, options, value, onChange }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--brand-deep)]">
          {label}
        </span>
        <span className="text-[12px] text-[color:var(--muted)]">
          {options.find((item) => item.value === value)?.label || value}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={optionButtonClass(option.value === value)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ThemePopover() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => getStoredThemePopoverSettings());

  const summary = useMemo(() => {
    const mode = MODE_OPTIONS.find((item) => item.value === settings.mode)?.label || settings.mode;
    const warmth = WARMTH_OPTIONS.find((item) => item.value === settings.warmth)?.label || settings.warmth;
    const proseFont = PROSE_FONT_OPTIONS.find((item) => item.value === settings.proseFont)?.label || settings.proseFont;
    return `${mode} · ${warmth} · ${proseFont}`;
  }, [settings]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function updateSettings(patch) {
    const nextSettings = { ...settings, ...patch };
    setSettings(nextSettings);
    saveThemePopoverSettings(nextSettings);
    applyThemePopoverSettings(nextSettings);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="ghost-btn flex items-center gap-2"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>主题</span>
        <span className="hidden text-[11px] text-[color:var(--muted)] md:inline">
          {summary}
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[16px] border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--panel-strong)_94%,white)] p-4 shadow-[0_18px_40px_color-mix(in_srgb,var(--text)_12%,transparent)]"
          role="dialog"
          aria-label="主题设置"
        >
          <div className="mb-4 grid gap-1 border-b border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] pb-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-deep)]">
              Theme
            </span>
            <h3 className="font-serif text-[1.1rem] font-semibold text-[color:var(--text)]">
              编辑器偏好
            </h3>
            <p className="text-[12px] leading-6 text-[color:var(--muted)]">
              这里只保留明暗、暖橙深浅和正文阅读字体。
            </p>
          </div>

          <div className="grid gap-4">
            <ThemeControlGroup
              label="Mode"
              options={MODE_OPTIONS}
              value={settings.mode}
              onChange={(mode) => updateSettings({ mode })}
            />
            <ThemeControlGroup
              label="Warmth"
              options={WARMTH_OPTIONS}
              value={settings.warmth}
              onChange={(warmth) => updateSettings({ warmth })}
            />
            <ThemeControlGroup
              label="Prose"
              options={PROSE_FONT_OPTIONS}
              value={settings.proseFont}
              onChange={(proseFont) => updateSettings({ proseFont })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
