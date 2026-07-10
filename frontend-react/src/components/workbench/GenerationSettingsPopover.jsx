import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TEMPERATURE_OPTIONS = [
  { value: 0.3, label: '保守', desc: '严格遵照大纲，变化少' },
  { value: 0.7, label: '平衡', desc: '兼顾大纲和创意' },
  { value: 1.0, label: '发散', desc: '更自由，可能偏离大纲' }
];

const PRESET_OPTIONS = [
  {
    value: 'fast',
    label: '快节奏',
    desc: '对话更密，推进更快',
    settings: {
      emotionIntensity: 40,
      colloquialLevel: 80,
      dialogueRatio: 70,
      fastPace: true,
      detailedDesc: false,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: false
    }
  },
  {
    value: 'balanced',
    label: '均衡',
    desc: '兼顾推进与稳定',
    settings: {
      emotionIntensity: 70,
      colloquialLevel: 60,
      dialogueRatio: 50,
      fastPace: false,
      detailedDesc: false,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true
    }
  },
  {
    value: 'detailed',
    label: '细腻描写',
    desc: '细节更足，留白更少',
    settings: {
      emotionIntensity: 90,
      colloquialLevel: 30,
      dialogueRatio: 30,
      fastPace: false,
      detailedDesc: true,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true
    }
  }
];

const TOGGLE_OPTIONS = [
  { field: 'fastPace', label: '节奏偏快', desc: '尽快切入冲突、变化和关键推进。' },
  { field: 'detailedDesc', label: '细节描写', desc: '补足动作、感官和环境细节。' },
  { field: 'enhanceDialogue', label: '强化对话', desc: '让对话承担推进关系和信息的功能。' },
  { field: 'addCliffhanger', label: '结尾钩子', desc: '章节收尾保留压力、悬念或未解问题。' },
  { field: 'avoidAIFeel', label: '去 AI 味', desc: '避免空泛抒情、模板化总结和明显机翻腔。' }
];

export default function GenerationSettingsPopover({ settings, onUpdate, onSave, saveDisabled = false, saveLabel = '保存生成控制', children }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const popoverRef = useRef(null);
  const current = {
    word_count: Number(settings?.word_count || 3000),
    temperature: Number(settings?.temperature ?? 0.7),
    emotionIntensity: Number(settings?.emotionIntensity ?? 70),
    colloquialLevel: Number(settings?.colloquialLevel ?? 80),
    dialogueRatio: Number(settings?.dialogueRatio ?? 30),
    fastPace: Boolean(settings?.fastPace),
    detailedDesc: Boolean(settings?.detailedDesc),
    enhanceDialogue: settings?.enhanceDialogue !== false,
    addCliffhanger: settings?.addCliffhanger !== false,
    avoidAIFeel: settings?.avoidAIFeel !== false,
    custom_instruction: String(settings?.custom_instruction || '')
  };

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!popoverRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function placePanel() {
      const trigger = popoverRef.current?.querySelector('.gen-settings-trigger');
      const rect = trigger?.getBoundingClientRect();
      if (!rect) return;

      const margin = 12;
      const panelWidth = Math.min(360, window.innerWidth - margin * 2);
      const top = Math.max(margin, Math.min(rect.bottom + 6, window.innerHeight - 420));
      const left = Math.max(margin, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - margin));

      setPanelStyle({
        top,
        left,
        width: panelWidth,
        maxHeight: Math.max(280, window.innerHeight - top - margin)
      });
    }

    placePanel();
    window.addEventListener('resize', placePanel);
    return () => window.removeEventListener('resize', placePanel);
  }, [open]);

  function handleUpdate(field, value) {
    onUpdate?.(field, value);
  }

  function applyPreset(preset) {
    Object.entries(preset.settings).forEach(([field, value]) => {
      handleUpdate(field, value);
    });
  }

  return (
    <div className="gen-settings-popover" ref={popoverRef}>
      {children ? (
        <button type="button" className="gen-settings-trigger" onClick={() => setOpen((v) => !v)}>
          {children}
        </button>
      ) : null}
      {open ? (
        <div className="gen-settings-panel" style={panelStyle} role="dialog" aria-label="生成参数">
          <div className="gen-settings-panel-head">
            <div>
              <strong>生成参数</strong>
              <small>正文控制会随当前章节保存</small>
            </div>
            <button type="button" onClick={() => setOpen(false)}>关闭</button>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">目标字数</label>
            <div className="gen-settings-row">
              <input
                type="number"
                className="gen-settings-input"
                min={500}
                max={20000}
                step={500}
                value={current.word_count}
                onChange={(e) => handleUpdate('word_count', Number(e.target.value))}
              />
              <span className="gen-settings-hint">500 – 20000</span>
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">写法预设</label>
            <div className="gen-settings-options">
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={'gen-settings-option' + (
                    current.fastPace === !!opt.settings.fastPace
                    && current.detailedDesc === !!opt.settings.detailedDesc
                    && current.emotionIntensity === opt.settings.emotionIntensity
                    && current.colloquialLevel === opt.settings.colloquialLevel
                    && current.dialogueRatio === opt.settings.dialogueRatio
                      ? ' is-active'
                      : ''
                  )}
                  onClick={() => applyPreset(opt)}
                >
                  <strong>{opt.label}</strong>
                  <small>{opt.desc}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">创意强度</label>
            <div className="gen-settings-slider-row">
              <input
                type="range"
                className="gen-settings-range"
                min={0}
                max={1}
                step={0.1}
                value={current.temperature}
                onChange={(e) => handleUpdate('temperature', Number(e.target.value))}
              />
              <span className="gen-settings-range-label">
                {TEMPERATURE_OPTIONS.find((t) => Math.abs(t.value - current.temperature) < 0.05)?.label || current.temperature.toFixed(1)}
              </span>
            </div>
            <div className="gen-settings-range-ticks">
              <span>保守</span>
              <span>发散</span>
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">情绪渲染</label>
            <div className="gen-settings-slider-row">
              <input
                type="range"
                className="gen-settings-range"
                min={0}
                max={100}
                step={5}
                value={current.emotionIntensity}
                onChange={(e) => handleUpdate('emotionIntensity', Number(e.target.value))}
              />
              <span className="gen-settings-range-label">{current.emotionIntensity}%</span>
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">口语化程度</label>
            <div className="gen-settings-slider-row">
              <input
                type="range"
                className="gen-settings-range"
                min={0}
                max={100}
                step={5}
                value={current.colloquialLevel}
                onChange={(e) => handleUpdate('colloquialLevel', Number(e.target.value))}
              />
              <span className="gen-settings-range-label">{current.colloquialLevel}%</span>
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">对话占比</label>
            <div className="gen-settings-slider-row">
              <input
                type="range"
                className="gen-settings-range"
                min={0}
                max={100}
                step={5}
                value={current.dialogueRatio}
                onChange={(e) => handleUpdate('dialogueRatio', Number(e.target.value))}
              />
              <span className="gen-settings-range-label">{current.dialogueRatio}%</span>
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">正文控制</label>
            <div className="gen-settings-toggle-grid">
              {TOGGLE_OPTIONS.map((opt) => (
                <label key={opt.field} className="gen-settings-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(current[opt.field])}
                    onChange={(e) => handleUpdate(opt.field, e.target.checked)}
                  />
                  <span className="gen-settings-toggle-copy">
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="gen-settings-section">
            <label className="gen-settings-label">附加指令（可选）</label>
            <textarea
              className="gen-settings-textarea"
              rows={3}
              placeholder="例如：多用对话、控制旁白比例、保持第三人称..."
              value={current.custom_instruction}
              onChange={(e) => handleUpdate('custom_instruction', e.target.value)}
            />
          </div>
          <div className="gen-settings-section">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onSave?.()}
              disabled={saveDisabled}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
