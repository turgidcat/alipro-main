import { useEffect, useMemo, useState } from 'react';
import {
  createCharacterCard,
  fetchBookCharacters,
  fetchBookChapterPlans,
  fetchBookChapters,
  fetchBookList,
  fetchBookVolumePlans,
  generateInspiration,
  persistCurrentBookId,
  saveBookPlan,
  saveChapterPlan,
  saveVolumePlan
} from '../workbenchApi.js';
import '../styles.css';
import '../app-shell.css';
import './inspiration-page.css';

const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');

function buildAppPath(pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const cleanBase = APP_BASE_PATH.endsWith('/') ? APP_BASE_PATH : `${APP_BASE_PATH}/`;
  return cleanPath ? `${cleanBase}${cleanPath}` : cleanBase;
}

function parseStructured(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return {}; }
}

function normalizeCandidate(candidate = {}, index = 0) {
  return {
    id: candidate.id || `candidate-${index + 1}`,
    title: candidate.title || `灵感方案 ${index + 1}`,
    genre: candidate.genre || '未定题材',
    tone: candidate.tone || '待定情绪',
    premise: candidate.premise || '模型暂未补充故事前提。',
    worldview: {
      summary: candidate.worldview?.summary || '模型暂未补充世界观摘要。',
      rules: Array.isArray(candidate.worldview?.rules) ? candidate.worldview.rules.filter(Boolean) : []
    },
    characters: Array.isArray(candidate.characters) ? candidate.characters : [],
    centralConflict: candidate.centralConflict || '模型暂未补充核心冲突。',
    storyDirection: candidate.storyDirection || '模型暂未补充发展方向。',
    plotOutline: candidate.plotOutline || '模型暂未补充剧情展开。',
    keyScenes: Array.isArray(candidate.keyScenes) ? candidate.keyScenes.filter(Boolean) : [],
    openingHook: candidate.openingHook || '',
    endingHook: candidate.endingHook || '',
    fitReason: candidate.fitReason || '模型暂未补充层级适配说明。',
    strategicValue: candidate.strategicValue || '模型暂未补充长期价值。',
    risks: Array.isArray(candidate.risks) ? candidate.risks.filter(Boolean) : [],
    nextSteps: Array.isArray(candidate.nextSteps) ? candidate.nextSteps.filter(Boolean) : [],
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter(Boolean) : []
  };
}

function formatCharacterNotes(character = {}) {
  return [
    character.role ? `定位：${character.role}` : '',
    character.personality ? `性格：${character.personality}` : '',
    character.background ? `背景：${character.background}` : ''
  ].filter(Boolean).join('\n');
}

function formatWorldRules(candidate) {
  return [
    candidate.worldview.summary,
    ...candidate.worldview.rules.map((rule) => `- ${rule}`)
  ].filter(Boolean).join('\n');
}

function getNextChapterNumber(chapters = [], chapterPlans = []) {
  const numbers = [...(Array.isArray(chapters) ? chapters : []), ...(Array.isArray(chapterPlans) ? chapterPlans : [])]
    .map((chapter) => Number(chapter.chapter_number || 0))
    .filter((number) => number > 0);
  return Math.max(1, ...numbers) + (numbers.length > 0 ? 1 : 0);
}

function getNextChapterNumberForVolume(volumeNumber, chapters = [], chapterPlans = []) {
  const scopedPlans = (Array.isArray(chapterPlans) ? chapterPlans : []).filter((item) => Number(item.volume_number || 1) === Number(volumeNumber));
  if (scopedPlans.length > 0) return getNextChapterNumber([], scopedPlans);
  return getNextChapterNumber(chapters, chapterPlans);
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function InspirationPage() {
  const [books, setBooks] = useState([]);
  const [mode, setMode] = useState('general');
  const [scope, setScope] = useState('volume');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [volumePlans, setVolumePlans] = useState([]);
  const [chapterPlans, setChapterPlans] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [volumeNumber, setVolumeNumber] = useState(1);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [creativeFocus, setCreativeFocus] = useState('');
  const [constraints, setConstraints] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeCandidate = candidates[activeIndex] || null;
  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) || null, [books, selectedBookId]);
  const selectedVolumePlan = useMemo(
    () => volumePlans.find((plan) => Number(plan.volume_number || plan.volumeNumber || 0) === Number(volumeNumber)) || null,
    [volumePlans, volumeNumber]
  );
  const volumeOptions = useMemo(() => {
    const values = volumePlans.map((plan) => Number(plan.volume_number || plan.volumeNumber || 0)).filter((value) => value > 0);
    const next = Math.max(1, ...values) + 1;
    return [...new Set([...values, next])].sort((a, b) => a - b);
  }, [volumePlans]);

  useEffect(() => {
    let alive = true;
    fetchBookList()
      .then((list) => {
        if (!alive) return;
        const nextBooks = Array.isArray(list) ? list : [];
        setBooks(nextBooks);
        const stored = (() => { try { return localStorage.getItem('currentBookId') || ''; } catch (_) { return ''; } })();
        setSelectedBookId(stored && nextBooks.some((book) => book.id === stored) ? stored : (nextBooks[0]?.id || ''));
      })
      .catch((loadError) => alive && setError(`作品列表加载失败：${loadError.message}`))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setVolumePlans([]); setChapterPlans([]); setChapters([]); setVolumeNumber(1); setChapterNumber(1);
      return undefined;
    }
    let alive = true;
    Promise.all([fetchBookVolumePlans(selectedBookId), fetchBookChapterPlans(selectedBookId), fetchBookChapters(selectedBookId)])
      .then(([nextVolumes, nextChapterPlans, nextChapters]) => {
        if (!alive) return;
        setVolumePlans(nextVolumes);
        setChapterPlans(nextChapterPlans);
        setChapters(nextChapters);
        const firstVolume = nextVolumes.map((item) => Number(item.volume_number || item.volumeNumber || 0)).filter((value) => value > 0).sort((a, b) => a - b)[0] || 1;
        setVolumeNumber(firstVolume);
        setChapterNumber(getNextChapterNumber(nextChapters, nextChapterPlans));
      })
      .catch((loadError) => alive && setError(`作品层级数据加载失败：${loadError.message}`));
    return () => { alive = false; };
  }, [selectedBookId]);

  function changeBook(bookId) {
    setSelectedBookId(bookId);
    persistCurrentBookId(bookId);
    setNotice('');
    setCandidates([]);
  }

  function changeScope(nextScope) {
    setScope(nextScope);
    setNotice('');
    if (nextScope === 'chapter' && !chapterNumber) setChapterNumber(getNextChapterNumberForVolume(volumeNumber, chapters, chapterPlans));
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true); setError(''); setNotice('');
    try {
      const result = await generateInspiration({
        mode, scope, prompt, creativeFocus, constraints, bookId: selectedBookId,
        volumeNumber, chapterNumber, targetChapterNumber: chapterNumber,
        contextMode: mode === 'latest_chapter' ? 'strong_continuity' : 'free'
      });
      const nextCandidates = Array.isArray(result?.candidates) ? result.candidates.map(normalizeCandidate) : [];
      if (nextCandidates.length === 0) throw new Error('没有得到可用的灵感方案');
      setCandidates(nextCandidates); setActiveIndex(0);
      setNotice(`已生成 3 个${scope === 'book' ? '全书' : scope === 'volume' ? '分卷' : '章节'}灵感方案，可以先挑一个继续展开。`);
    } catch (generateError) {
      setError(generateError.message || '灵感生成失败');
    } finally { setGenerating(false); }
  }

  async function saveCharacters() {
    const existingCharacters = await fetchBookCharacters(selectedBookId);
    const existingNames = new Set(existingCharacters.map((item) => String(item.name || '').trim()).filter(Boolean));
    const newCharacters = activeCandidate.characters.filter((character) => character?.name && !existingNames.has(String(character.name).trim()));
    await Promise.all(newCharacters.map((character) => createCharacterCard(selectedBookId, {
      name: character.name,
      appearance: character.appearance || '',
      personality: character.personality || '',
      background: character.background || '',
      notes: formatCharacterNotes(character)
    })));
    return newCharacters.length;
  }

  async function handleSaveToLibrary() {
    if (!activeCandidate || !selectedBookId || saving) return;
    setSaving('library'); setError('');
    const record = {
      inspiration_source: 'inspiration_explorer', scope, volume_number: volumeNumber, chapter_number: chapterNumber,
      user_prompt: prompt, creative_focus: creativeFocus, constraints, inspiration_card: activeCandidate,
      key_scenes: activeCandidate.keyScenes, opening_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook
    };
    try {
      let message = '';
      if (scope === 'book') {
        await saveBookPlan(selectedBookId, {
          premise: activeCandidate.premise, main_goal: activeCandidate.storyDirection,
          core_conflict: activeCandidate.centralConflict, world_rules: formatWorldRules(activeCandidate),
          main_outline: activeCandidate.plotOutline, structured_content: record, source: 'inspiration'
        });
        message = '全书规划已更新';
      } else if (scope === 'volume') {
        const existingStructured = parseStructured(selectedVolumePlan?.structured_content);
        await saveVolumePlan(selectedBookId, volumeNumber, {
          volume_name: selectedVolumePlan?.volume_name || activeCandidate.title,
          volume_theme: selectedVolumePlan?.volume_theme || activeCandidate.tone,
          stage_goal: activeCandidate.storyDirection,
          core_conflict: activeCandidate.centralConflict,
          start_role_state: selectedVolumePlan?.start_role_state || activeCandidate.premise,
          end_role_state: selectedVolumePlan?.end_role_state || activeCandidate.endingHook,
          estimated_chapters: Number(selectedVolumePlan?.estimated_chapters || 15),
          storyline_quota: Number(selectedVolumePlan?.storyline_quota || 3),
          notes: [activeCandidate.premise, activeCandidate.strategicValue].filter(Boolean).join('\n'),
          structured_content: { ...existingStructured, ...record }, source: 'ai'
        });
        message = `第 ${volumeNumber} 卷规划已更新`;
      } else {
        await saveChapterPlan(selectedBookId, chapterNumber, {
          volume_number: volumeNumber, chapter_name: activeCandidate.title, summary: activeCandidate.premise,
          chapter_mission: activeCandidate.storyDirection, emotion_target: activeCandidate.tone,
          outline_text: activeCandidate.plotOutline, scene_outline: activeCandidate.keyScenes,
          character_notes: [formatWorldRules(activeCandidate), activeCandidate.centralConflict].filter(Boolean).join('\n\n'),
          appearing_roles: activeCandidate.characters.map((character) => character?.name).filter(Boolean),
          previous_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook,
          structured_content: record, source: 'ai'
        });
        message = `第 ${volumeNumber} 卷第 ${chapterNumber} 章细纲已保存`;
      }
      const newCharacterCount = await saveCharacters();
      setNotice(`已写入《${selectedBook?.title || '当前作品'}》资料库：${message}${newCharacterCount ? `，新增 ${newCharacterCount} 张角色卡` : ''}。`);
    } catch (saveError) {
      setError(`保存到资料库失败：${saveError.message}`);
    } finally { setSaving(''); }
  }

  async function handleApplyToWorkbench() {
    if (!activeCandidate || !selectedBookId || saving) return;
    setSaving('workbench'); setError('');
    try {
      await saveChapterPlan(selectedBookId, chapterNumber, {
        volume_number: volumeNumber, chapter_name: activeCandidate.title, summary: activeCandidate.premise,
        chapter_mission: activeCandidate.storyDirection, emotion_target: activeCandidate.tone,
        outline_text: activeCandidate.plotOutline, scene_outline: activeCandidate.keyScenes,
        character_notes: [formatWorldRules(activeCandidate), activeCandidate.centralConflict, activeCandidate.fitReason].filter(Boolean).join('\n\n'),
        appearing_roles: activeCandidate.characters.map((character) => character?.name).filter(Boolean),
        previous_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook,
        structured_content: { inspiration_scope: scope, volume_number: volumeNumber, chapter_number: chapterNumber, inspiration_card: activeCandidate },
        source: 'ai'
      });
      persistCurrentBookId(selectedBookId);
      try { localStorage.setItem('alipro-workbench-pending-chapter', JSON.stringify({ bookId: selectedBookId, chapterNumber })); } catch (_) {}
      window.location.href = buildAppPath('/workbench');
    } catch (saveError) {
      setError(`加载到创作台失败：${saveError.message}`); setSaving('');
    }
  }

  const scopeLabel = scope === 'book' ? '全书' : scope === 'volume' ? `第 ${volumeNumber} 卷` : `第 ${volumeNumber} 卷第 ${chapterNumber} 章`;

  return (
    <div className="inspiration-page page-shell">
      <header className="inspiration-header">
        <div><div className="inspiration-kicker">INSPIRATION EXPLORER</div><h1>灵感探索</h1><p>先选择灵感要服务的层级，再让故事长出三条不同的路。</p></div>
        <div className="inspiration-header-note"><span className="inspiration-note-mark">✦</span><span>全书定方向，分卷搭引擎，章节落成戏；结果可以回写资料库，也可以直接送入创作台。</span></div>
      </header>

      <section className="inspiration-control-panel">
        <div className="inspiration-mode-tabs" role="tablist" aria-label="灵感模式">
          <button type="button" className={joinClasses('inspiration-mode-tab', mode === 'general' && 'is-active')} onClick={() => setMode('general')}><strong>自由探索</strong><span>高自由度发散，允许提出新假设</span></button>
          <button type="button" className={joinClasses('inspiration-mode-tab', mode === 'latest_chapter' && 'is-active')} onClick={() => { setMode('latest_chapter'); if (scope === 'volume') setScope('chapter'); }}><strong>强承接已有内容</strong><span>优先遵守当前剧情和最新章节</span></button>
        </div>
        <div className="inspiration-scope-tabs" role="tablist" aria-label="探索层级">
          {['book', 'volume', 'chapter'].map((item) => <button key={item} type="button" className={joinClasses('inspiration-scope-tab', scope === item && 'is-active')} onClick={() => changeScope(item)}><strong>{item === 'book' ? '全书灵感' : item === 'volume' ? '分卷灵感' : '章节灵感'}</strong><span>{item === 'book' ? '长期方向与世界支点' : item === 'volume' ? '阶段目标与剧情引擎' : '可直接落成章节细纲'}</span></button>)}
        </div>
        <div className="inspiration-form-grid">
          <label className="inspiration-field inspiration-field-book"><span>关联作品 <em>可选</em></span><select value={selectedBookId} onChange={(event) => changeBook(event.target.value)} disabled={loading}><option value="">不关联作品，完全自由探索</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
          {selectedBookId ? <label className="inspiration-field"><span>目标分卷</span><select value={String(volumeNumber)} onChange={(event) => { const nextVolume = Math.max(1, Number(event.target.value) || 1); setVolumeNumber(nextVolume); setChapterNumber(getNextChapterNumberForVolume(nextVolume, chapters, chapterPlans)); setNotice(''); }}><option value="1">第 1 卷</option>{volumeOptions.filter((value) => value !== 1).map((value) => <option key={value} value={value}>第 {value} 卷{volumePlans.some((plan) => Number(plan.volume_number || plan.volumeNumber) === value) ? '' : '（新建目标）'}</option>)}</select></label> : null}
          {scope === 'chapter' ? <label className="inspiration-field"><span>目标章节</span><input type="number" min="1" value={chapterNumber} onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
          <label className="inspiration-field inspiration-field-focus"><span>创作焦点 <em>可选</em></span><input value={creativeFocus} onChange={(event) => setCreativeFocus(event.target.value)} placeholder="例如：信息差、心理博弈、阵营互设陷阱" /></label>
          <label className="inspiration-field inspiration-field-prompt"><span>你现在想探索什么？ <em>可以留空</em></span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：我想在第二卷加入智斗的情节，但是没有什么思路。" rows={3} /></label>
          <label className="inspiration-field inspiration-field-constraints"><span>硬性约束 <em>可选</em></span><textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder="例如：不引入超自然能力；林逸不能直接透露未来；保留李承乾和李泰的既有性格。" rows={2} /></label>
        </div>
        <div className="inspiration-control-footer"><span>当前目标：{scopeLabel}。不填焦点也没关系，AI 会结合当前层级自动发散。</span><button type="button" className="inspiration-primary-btn" onClick={handleGenerate} disabled={generating || loading}>{generating ? '正在寻找灵感…' : '生成 3 个灵感方案'}</button></div>
      </section>

      {error ? <div className="inspiration-banner is-error">{error}</div> : null}
      {notice ? <div className="inspiration-banner is-success">{notice}</div> : null}

      {candidates.length > 0 ? <section className="inspiration-results">
        <div className="inspiration-section-head"><div><div className="inspiration-section-kicker">THREE DIRECTIONS · {scopeLabel}</div><h2>挑一条，让它继续生长</h2></div><span>{selectedBook ? `已关联：${selectedBook.title}` : '独立灵感草稿'}</span></div>
        <div className="inspiration-candidate-grid">{candidates.map((candidate, index) => <button type="button" key={candidate.id} className={joinClasses('inspiration-candidate-card', index === activeIndex && 'is-active')} onClick={() => setActiveIndex(index)}><span className="inspiration-card-index">0{index + 1}</span><strong>{candidate.title}</strong><span className="inspiration-card-meta">{candidate.genre} · {candidate.tone}</span><p>{candidate.premise}</p><span className="inspiration-card-world">适配：{candidate.fitReason || candidate.worldview.summary}</span></button>)}</div>
        {activeCandidate ? <article className="inspiration-detail-card">
          <div className="inspiration-detail-head"><div><span className="inspiration-detail-label">SELECTED DIRECTION · {scopeLabel}</span><h3>{activeCandidate.title}</h3></div><div className="inspiration-tag-list">{activeCandidate.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <div className="inspiration-detail-grid">
            <section className="inspiration-detail-block inspiration-detail-world"><h4>世界观</h4><p>{activeCandidate.worldview.summary}</p>{activeCandidate.worldview.rules.length > 0 ? <ul>{activeCandidate.worldview.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}</section>
            <section className="inspiration-detail-block"><h4>故事前提</h4><p>{activeCandidate.premise}</p><h4>核心冲突</h4><p>{activeCandidate.centralConflict}</p><h4>为什么适合当前层级</h4><p>{activeCandidate.fitReason}</p></section>
            <section className="inspiration-detail-block"><h4>人物卡</h4><div className="inspiration-character-list">{activeCandidate.characters.map((character) => <div key={character.name} className="inspiration-character-item"><strong>{character.name}</strong><span>{character.role || '待定定位'}</span><p>{character.personality || character.background || '等待进入资料库后继续补全。'}</p></div>)}</div></section>
            <section className="inspiration-detail-block"><h4>发展方向</h4><p>{activeCandidate.storyDirection}</p><h4>剧情展开</h4><p>{activeCandidate.plotOutline}</p>{activeCandidate.keyScenes.length > 0 ? <ol>{activeCandidate.keyScenes.map((scene) => <li key={scene}>{scene}</li>)}</ol> : null}</section>
            <section className="inspiration-detail-block"><h4>长期价值</h4><p>{activeCandidate.strategicValue}</p><h4>风险提示</h4>{activeCandidate.risks.length > 0 ? <ul>{activeCandidate.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p>暂无</p>}<h4>下一步</h4>{activeCandidate.nextSteps.length > 0 ? <ol>{activeCandidate.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol> : <p>暂无</p>}</section>
            <section className="inspiration-detail-block inspiration-detail-hooks"><div><h4>开场钩子</h4><p>{activeCandidate.openingHook || '待补'}</p></div><div><h4>结尾钩子</h4><p>{activeCandidate.endingHook || '待补'}</p></div></section>
          </div>
          <div className="inspiration-detail-actions"><span>写入资料库会保存到当前层级；应用到创作台会写入第 {volumeNumber} 卷第 {chapterNumber} 章。</span><div><button type="button" className="inspiration-secondary-btn" onClick={handleSaveToLibrary} disabled={!selectedBookId || Boolean(saving)}>{saving === 'library' ? '保存中…' : `写入${scope === 'book' ? '全书' : scope === 'volume' ? '分卷' : '章节'}资料库`}</button><button type="button" className="inspiration-primary-btn" onClick={handleApplyToWorkbench} disabled={!selectedBookId || Boolean(saving)}>{saving === 'workbench' ? '正在加载…' : '应用到创作台'}</button></div></div>
        </article> : null}
      </section> : <section className="inspiration-empty-state"><div className="inspiration-empty-orbit">✦</div><h2>先从一个模糊念头开始</h2><p>先选书、卷、章，也可以留空完全自由探索。一个画面、一种情绪，甚至一句“我想写点不一样的”，都可以成为入口。</p></section>}
    </div>
  );
}
