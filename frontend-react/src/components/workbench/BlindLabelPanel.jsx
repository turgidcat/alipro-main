import { useEffect, useState } from 'react';
import { fetchCalibrationSamples, saveCalibrationReview } from '../../workbenchApi.js';

const DIMENSIONS = [
  ['plot_progress', '剧情推进'], ['character_consistency', '人物一致性'], ['dialogue', '对白'],
  ['pacing', '节奏'], ['hook', '结尾钩子'], ['prose_naturalness', '文笔自然度']
];
const DEFECTS = [
  ['text_integrity', '文本完整性'], ['chapter_handoff', '章节衔接'], ['fact_continuity', '事实连续性'],
  ['character_continuity', '人物连续性'], ['plan_mission', '细纲任务'], ['outline_coverage', '大纲覆盖'],
  ['forbidden_event', '禁写事件'], ['summary_fidelity', '摘要一致性'], ['pacing', '节奏问题'],
  ['dialogue', '对白问题'], ['prose_naturalness', '文笔不自然'], ['repetition', '内容重复'], ['ending_hook', '结尾钩子']
];
const SCORE_LABELS = [
  [1, '明显不合格'], [2, '较差'], [3, '一般'], [4, '较好'], [5, '优秀']
];

function emptyReview(reviewer) {
  return {
    semantic_pass: null,
    severe_defect: null,
    defect_types: [],
    literary_scores: Object.fromEntries(DIMENSIONS.map(([key]) => [key, null])),
    evidence: [{ source: 'current', quote: '', note: '' }],
    notes: '',
    reviewer
  };
}

function fromSample(sample, reviewer) {
  const saved = sample?.reviews?.[reviewer];
  if (!saved || typeof saved !== 'object' || typeof saved.semantic_pass !== 'boolean') return emptyReview(reviewer);
  return {
    ...emptyReview(reviewer), ...saved, reviewer,
    literary_scores: { ...emptyReview(reviewer).literary_scores, ...(saved.literary_scores || {}) },
    evidence: Array.isArray(saved.evidence) && saved.evidence.length ? saved.evidence : [{ source: 'current', quote: '', note: '' }]
  };
}

function isComplete(review) {
  return typeof review?.semantic_pass === 'boolean'
    && typeof review?.severe_defect === 'boolean'
    && DIMENSIONS.every(([key]) => Number(review?.literary_scores?.[key]) >= 1);
}

export default function BlindLabelPanel({ bookId, chapterNumber }) {
  const [reviewer, setReviewer] = useState('reviewer_a');
  const [sample, setSample] = useState(null);
  const [review, setReview] = useState(emptyReview('reviewer_a'));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open || !bookId) return;
    let alive = true;
    setLoading(true); setMessage('');
    fetchCalibrationSamples(bookId, reviewer).then((result) => {
      if (!alive) return;
      const found = (result?.samples || []).find((item) => Number(item.chapter_number) === Number(chapterNumber));
      setSample(found || null); setReview(fromSample(found, reviewer));
    }).catch((error) => alive && setMessage(error.message || '盲标样本加载失败')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, bookId, chapterNumber, reviewer]);

  function update(patch) { setReview((current) => ({ ...current, ...patch })); }

  async function save() {
    if (!sample) return;
    if (!isComplete(review)) { setMessage('请完成两个判断和六项评分后再保存。'); return; }
    setSaving(true); setMessage('');
    try {
      await saveCalibrationReview({ bookId, sampleId: sample.id, sampleHash: sample.sample_hash, reviewer, review });
      setMessage('本章盲标已保存。Judge 结论仍保持隐藏。');
    } catch (error) { setMessage(error.message || '保存失败'); } finally { setSaving(false); }
  }

  return (
    <section className="blind-label-panel">
      <style>{`
        .blind-label-panel{margin-top:14px;border:1px solid rgba(123,193,187,.25);border-radius:12px;background:rgba(10,29,32,.8);overflow:hidden}.blind-label-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer;list-style:none;color:#dff4ef}.blind-label-summary::-webkit-details-marker{display:none}.blind-label-summary strong{font-size:14px}.blind-label-summary span{color:#91b7b1;font-size:12px}.blind-label-body{padding:14px;border-top:1px solid rgba(123,193,187,.18)}.blind-label-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#bdd7d2;font-size:13px}.blind-label-toolbar select,.blind-label-choice,.blind-label-score select,.blind-label-evidence select,.blind-label-evidence input,.blind-label-body textarea{background:#0d2529;color:#eefbf8;border:1px solid #477d78;border-radius:7px;padding:7px 9px}.blind-label-choice{cursor:pointer}.blind-label-choice.is-selected{background:#14504b;border-color:#68dfd0}.blind-label-hint{margin:10px 0;color:#9fbdb8;font-size:12px}.blind-label-defects{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.blind-label-defects label{color:#c8dfda;font-size:12px}.blind-label-scores{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}.blind-label-score{display:flex;flex-direction:column;gap:4px;color:#bcd6d1;font-size:12px}.blind-label-score select{width:100%;box-sizing:border-box}.blind-label-evidence{display:flex;gap:8px;margin:8px 0}.blind-label-evidence input{flex:1;min-width:0}.blind-label-body textarea{width:100%;box-sizing:border-box;min-height:60px;resize:vertical}.blind-label-save{margin-top:9px;padding:8px 14px;border-radius:7px;border:1px solid #75e5d8;background:#19b8a8;color:#052723;font-weight:700;cursor:pointer}.blind-label-message{margin-top:8px;color:#b8d8d2;font-size:12px}.blind-label-empty{color:#a9c3be;font-size:13px}@media(max-width:700px){.blind-label-scores{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="blind-label-summary"><span><strong>人工盲标</strong>　<span>默认折叠 · 不显示 Judge 结论</span></span><span>用于收集真实反馈，校准 Judge</span></summary>
        <div className="blind-label-body">
          <div className="blind-label-toolbar"><label>这是第几次独立判断？ <select value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option value="reviewer_a">第一次判断</option><option value="reviewer_b">第二次判断</option></select></label><span>当前章：第 {chapterNumber} 章</span></div>
          {loading ? <p className="blind-label-empty">正在读取本章盲标样本...</p> : null}
          {!loading && !sample ? <p className="blind-label-empty">当前章节暂无可盲标正文，先生成或保存正文后再标注。</p> : null}
          {!loading && sample ? <>
            <p className="blind-label-hint">上方正文和细纲就是本次盲标材料。请先独立判断，不要打开 Judge 对照。</p>
            <div className="blind-label-toolbar"><span>正文是否有问题：</span><button type="button" className={`blind-label-choice ${review.semantic_pass === true ? 'is-selected' : ''}`} onClick={() => update({ semantic_pass: true })}>通过</button><button type="button" className={`blind-label-choice ${review.semantic_pass === false ? 'is-selected' : ''}`} onClick={() => update({ semantic_pass: false })}>有问题</button><span>严重影响后续：</span><button type="button" className={`blind-label-choice ${review.severe_defect === false ? 'is-selected' : ''}`} onClick={() => update({ severe_defect: false })}>否</button><button type="button" className={`blind-label-choice ${review.severe_defect === true ? 'is-selected' : ''}`} onClick={() => update({ severe_defect: true })}>是</button></div>
            <div className="blind-label-defects">{DEFECTS.map(([key, label]) => <label key={key}><input type="checkbox" checked={review.defect_types.includes(key)} onChange={(event) => update({ defect_types: event.target.checked ? [...review.defect_types, key] : review.defect_types.filter((item) => item !== key) })} /> {label}</label>)}</div>
            <p className="blind-label-hint">评分统一按 1–5 分：1 分明显不合格，2 分较差，3 分一般，4 分较好，5 分优秀。</p>
            <div className="blind-label-scores">{DIMENSIONS.map(([key, label]) => <label className="blind-label-score" key={key}>{label}<select value={review.literary_scores[key] || ''} onChange={(event) => update({ literary_scores: { ...review.literary_scores, [key]: Number(event.target.value) || null } })}><option value="">请选择</option>{SCORE_LABELS.map(([value, description]) => <option value={value} key={value}>{value} 分｜{description}</option>)}</select></label>)}</div>
            <div className="blind-label-evidence"><select value={review.evidence[0]?.source || 'current'} onChange={(event) => update({ evidence: [{ ...review.evidence[0], source: event.target.value }] })}><option value="current">正文证据</option><option value="previous">上一章证据</option></select><input value={review.evidence[0]?.quote || ''} placeholder="如判定有问题，粘贴一条原句" onChange={(event) => update({ evidence: [{ ...review.evidence[0], quote: event.target.value }] })} /></div>
            <textarea value={review.notes} placeholder="补充说明（可选）" onChange={(event) => update({ notes: event.target.value })} /><br /><button type="button" className="blind-label-save" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存本章盲标'}</button>{message ? <div className="blind-label-message">{message}</div> : null}
          </> : null}
        </div>
      </details>
    </section>
  );
}
