const $ = id => document.getElementById(id);
const token = location.hash.slice(1) || sessionStorage.getItem('monitorToken') || '';
if (location.hash) { sessionStorage.setItem('monitorToken', token); history.replaceState(null, '', '/'); }
const state = { records: [], points: [], selected: null, record: null, tab: 'input', paused: false, limit: 150, busy: false, diffText: '', matrixCategory: 'all', matrixOpen: new Set(['outline', 'chapter']), matrixSignature: '' };
const matrixCategories = [
  { id: 'preparation', label: '创作准备', groups: ['灵感探索', '基础创作'], description: '探索方向、书名与章节名、角色起名及小传', order: ['inspiration.generate', 'book.title', 'chapter.title', 'character.names', 'character.profiles'] },
  { id: 'planning', label: '全书与分卷', groups: ['全书规划', '分卷规划'], description: '全书大纲 → 角色一致性纠偏；拆卷 → 卷数修复', order: ['book.outline', 'book.outline-repair', 'volume.split', 'volume.repair'] },
  { id: 'story', label: '角色与剧情线', groups: ['角色库', '叙事脉络'], description: '角色卡资料、剧情线集合、关键节点与本卷时间线', order: ['character.card', 'character.batch', 'storyline.set', 'storyline.outline', 'storyline.timeline'] },
  { id: 'outline', label: '章节细纲', groups: ['细纲'], description: '生成 → 节点 / 密度 / 人物审校 → 按需纠偏；结构化单独调用', order: ['outline.generate', 'outline.story-audit', 'outline.density', 'outline.roles', 'outline.repair', 'outline.breakdown'] },
  { id: 'chapter', label: '正文与反馈', groups: ['正文', '章节反馈'], description: '正文初稿与按需调整、审校、修稿；章节反馈独立生成', order: ['chapter.generate', 'chapter.stream', 'chapter.wordcount', 'chapter.ending', 'chapter.audit', 'chapter.repair', 'feedback.generate', 'feedback.retry', 'feedback.repair'] },
  { id: 'helpers', label: '辅助工具', groups: ['辅助工具'], description: '润色、续写、人物与情节检查、伏笔识别、优化和翻译', order: ['text.polish', 'text.continue', 'check.character', 'check.plot', 'check.foreshadow', 'text.optimize', 'text.translate'] },
  { id: 'audio', label: '有声书', groups: ['有声书'], description: '实际分段文本与语音合成参数', order: ['audio.synthesize'] },
  { id: 'validation', label: '开发验收', groups: ['开发验收'], description: '独立质量裁判，供开发脚本使用', order: ['harness.judge'] }
];
function categorizedPoints() {
  const categories = matrixCategories.map(c => ({ ...c, points: state.points.filter(p => c.groups.includes(p.group)).sort((a, b) => {
    const rank = p => c.order.includes(p.id) ? c.order.indexOf(p.id) : c.order.length;
    return rank(a) - rank(b);
  }) }));
  const known = new Set(categories.flatMap(c => c.points.map(p => p.id)));
  const other = state.points.filter(p => !known.has(p.id));
  if (other.length) categories.push({ id: 'other', label: '其他点位', description: '新增点位，待补充分类', points: other });
  return categories;
}
function visibleMatrixCategories() {
  const query = $('matrixSearch').value.trim().toLowerCase();
  return categorizedPoints().filter(c => state.matrixCategory === 'all' || c.id === state.matrixCategory).map(c => ({ ...c, points: c.points.filter(p => !query || [c.label, p.group, p.label, p.id, p.entry, p.input, p.output, p.repeat, p.file].join(' ').toLowerCase().includes(query)) })).filter(c => c.points.length);
}
const statusLabels = { running: '进行中', completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断' };
const fmt = n => Number(n || 0).toLocaleString('zh-CN');
const chars = s => [...String(s || '')].length;
const time = s => new Date(s).toLocaleTimeString('zh-CN', { hour12: false });
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const messagesOf = r => r.request.messages || r.request.input?.messages || [{ role: 'text', content: r.request.text || JSON.stringify(r.request, null, 2) }];
async function api(route) {
  const res = await fetch('/api/' + route, { headers: { 'X-Monitor-Token': token } });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || `HTTP ${res.status}`);
  return data;
}
function tell(text) { $('notice').textContent = text; }
async function clipboard(text) {
  try {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const field = document.createElement('textarea'); field.value = text;
      field.style.cssText = 'position:fixed;top:0;left:-9999px'; document.body.appendChild(field);
      let copied = false;
      try { field.focus(); field.select(); copied = document.execCommand('copy'); } finally { field.remove(); }
      if (!copied) throw Error('clipboard unavailable');
    }
    tell('已复制。诊断包包含完整输入输出，请确认内容后发送。');
  } catch { tell('剪贴板不可用，可导出完整JSON，或手动选中文本复制。'); }
}
function download(name, content, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function drawList() {
  const groups = new Map();
  state.records.forEach(r => { if (!groups.has(r.traceId)) groups.set(r.traceId, []); groups.get(r.traceId).push(r); });
  $('calls').innerHTML = [...groups.entries()].map(([id, list]) => {
    list.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.sequence - b.sequence);
    const first = list[0];
    return `<div class="trace-title">${escape(first.bookTitle || (first.bookId ? first.bookId.slice(0, 12) : first.route))}${first.chapter ? ' · 第' + escape(first.chapter) + '章' : ''}<br>操作 ${escape(id.slice(0, 8))} · ${list.length} 次请求（当前筛选内）</div>` + list.map(r => `<button class="call ${state.selected === r.id ? 'selected' : ''}" data-id="${escape(r.id)}"><span class="row"><b>${escape(r.label)}</b><span class="status ${escape(r.status)}">${escape(statusLabels[r.status] || r.status)}</span></span><small>${time(r.startedAt)} · 输入 ${fmt(r.inputChars)} 字符 → 输出 ${fmt(r.outputChars)}</small><small>${escape(r.pointId)}${r.attempt > 1 ? ' · 第' + r.attempt + '次发送' : ''}</small></button>`).join('');
  }).join('');
}
function drawMatrix() {
  const categories = categorizedPoints(), visible = visibleMatrixCategories();
  const signature = JSON.stringify([state.matrixCategory, $('matrixSearch').value, state.points]);
  if (signature !== state.matrixSignature) {
    state.matrixSignature = signature;
    $('matrixCategories').innerHTML = [{ id: 'all', label: '全部', points: state.points }, ...categories].map(c => `<button data-category="${c.id}" class="${state.matrixCategory === c.id ? 'active' : ''}" aria-pressed="${state.matrixCategory === c.id}">${escape(c.label)} <span>${c.points.length}</span></button>`).join('');
    $('matrixHint').textContent = `${visible.length} 类 · ${visible.reduce((n, c) => n + c.points.length, 0)} / ${state.points.length} 个点位`;
    $('matrixRows').innerHTML = visible.length ? visible.map(c => `<details class="matrix-group" data-category="${c.id}" ${state.matrixCategory !== 'all' || $('matrixSearch').value.trim() || state.matrixOpen.has(c.id) ? 'open' : ''}><summary><span class="matrix-group-title">${escape(c.label)} <em>${c.points.length} 个点位</em></span><span class="matrix-group-description">${escape(c.description)}</span></summary><div class="table-scroll"><table><thead><tr><th>点位 / 阶段</th><th>INPUT 输入来源</th><th>OUTPUT 输出</th><th>追加 / 重试机制</th><th>调用次数</th></tr></thead><tbody>${c.points.map(p => `<tr data-point-id="${escape(p.id)}"><td><b>${escape(p.label)}</b><small>${escape(p.id)}</small><details class="matrix-source"><summary>入口与代码位置</summary><small>${escape(p.entry)}</small><small>${escape(p.file)}</small></details></td><td>${escape(p.input)}</td><td>${escape(p.output)}</td><td>${escape(p.repeat)}</td><td><span data-count-id="${escape(p.id)}">0</span></td></tr>`).join('')}</tbody></table></div></details>`).join('') : '<p class="matrix-empty">没有匹配点位。可清空搜索或切换到“全部”。</p>';
  }
  const counts = new Map(); state.records.forEach(r => counts.set(r.pointId, (counts.get(r.pointId) || 0) + 1));
  document.querySelectorAll('[data-count-id]').forEach(el => el.textContent = counts.get(el.dataset.countId) || 0);
}
function sectionInfo(text) {
  const result = []; let name = '开头内容', value = '';
  for (const line of String(text).split('\n')) {
    if (/^(?:【[^】]+】|#{1,4} |[\u4e00-\u9fa5]{2,18}[：:]\s*$)/.test(line)) {
      if (value) result.push({ name, size: chars(value) }); name = line.slice(0, 64); value = '';
    }
    value += line + '\n';
  }
  if (value) result.push({ name, size: chars(value) });
  return result;
}
function repeatedLines(r) {
  const counts = new Map();
  messagesOf(r).forEach(m => String(m.content).split(/\r?\n/).forEach(line => {
    const value = line.trim(); if (chars(value) >= 30) counts.set(value, (counts.get(value) || 0) + 1);
  }));
  return [...counts.entries()].filter(([, n]) => n > 1);
}
function renderDetail(r) {
  $('empty').hidden = true; $('detail').hidden = false;
  $('point').textContent = `${r.group} / ${r.pointId}`;
  $('title').textContent = r.label;
  $('meta').textContent = `${new Date(r.startedAt).toLocaleString('zh-CN')} · ${r.provider} / ${r.request.model || '语音合成'} · ${r.environment} · 源码 ${r.version} / ${r.sourceHash.slice(0, 10)} · 操作 ${r.traceId.slice(0, 8)} · ${r.bookTitle || r.bookId || '未关联作品'}${r.chapter ? ' / 第' + r.chapter + '章' : ''}${r.sourceContextHash ? ' · 资料 ' + r.sourceContextHash.slice(0, 10) : ''}${r.feedbackFreshness ? ' · 反馈 ' + ({current:'当前版本',stale:'已过期',legacy_unverified:'旧记录待核实',missing:'未生成'}[r.feedbackFreshness] || r.feedbackFreshness) : ''}`;
  const elapsed = r.status === 'running' ? Date.now() - Date.parse(r.startedAt) : r.elapsedMs;
  const usage = r.usage;
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens;
  const completionTokens = usage?.completion_tokens ?? usage?.output_tokens;
  const stat = (title, value, note) => `<div class="stat"><small>${title}</small><b>${escape(value)}</b><span>${escape(note)}</span></div>`;
  $('stats').innerHTML = stat('输入字符', fmt(r.inputChars), `${messagesOf(r).length} 条消息 · 请求体 ${fmt(new TextEncoder().encode(JSON.stringify(r.request)).length)} 字节`) + stat('输出字符', fmt(r.outputChars), statusLabels[r.status] || r.status) + stat('模型 token · 输入 / 输出', promptTokens == null ? '未返回' : `${fmt(promptTokens)} / ${completionTokens == null ? '—' : fmt(completionTokens)}`, usage?.prompt_cache_hit_tokens != null ? `缓存命中 ${fmt(usage.prompt_cache_hit_tokens)}` : '仅使用服务商返回的用量') + stat('耗时', (Math.max(0, elapsed) / 1000).toFixed(1) + ' s', `第 ${r.attempt} 次网络发送 · ${r.finishReason || '尚无结束原因'}`);
  const chain = state.records.filter(item => item.traceId === r.traceId).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.sequence - b.sequence);
  $('chain').innerHTML = chain.map((item, i) => `<button data-id="${item.id}" class="${item.id === r.id ? 'active' : ''}">${i + 1}. ${escape(item.label)}</button>`).join('');
  const repeats = repeatedLines(r);
  const warning = [];
  if (repeats.length) warning.push(`有 ${repeats.length} 段长文本行重复出现（只是线索，不等于错误）：${repeats.slice(0, 3).map(([line, count]) => `${line.slice(0, 70)}… ×${count}`).join('；')}`);
  if (r.error) warning.push(`请求状态：${r.error.message}；已收到的部分输出仍保留。`);
  if (r.pointId === 'unclassified') warning.push('新调用尚未登记点位；实际输入输出已捕获，请补充点位矩阵。');
  if (r.parseWarnings) warning.push(`观察器遇到 ${r.parseWarnings} 个无法解析的流片段，完整原始流可在“完整请求 / 响应”查看。`);
  $('warnings').innerHTML = warning.map(w => `<div class="warning">${escape(w)}</div>`).join('');
  if ($('messages').dataset.request !== r.id) {
    $('messages').dataset.request = r.id;
    $('messages').innerHTML = messagesOf(r).map((m, i) => `<div class="message"><div class="message-head"><span class="role">${i + 1} / ${escape(m.role).toUpperCase()}</span><span>${fmt(chars(m.content))} 字符 · ${r.inputChars ? Math.round(chars(m.content) / r.inputChars * 100) : 0}%</span></div><div class="bar"><span style="width:${r.inputChars ? Math.min(100, chars(m.content) / r.inputChars * 100) : 0}%"></span></div><pre>${escape(m.content)}</pre><details><summary class="muted">查看输入分段体积（按标题识别，辅助定位）</summary><div class="sections">${sectionInfo(m.content).map(s => `<span>${escape(s.name)} · ${fmt(s.size)}</span>`).join('')}</div></details></div>`).join('');
  }
  $('output').textContent = r.output || (r.status === 'running' ? '等待模型返回…' : '无文本输出');
  $('outputState').textContent = r.request.stream ? '流式响应 · 约每秒更新' : '非流式响应 · 完成后显示';
  $('reasoning').textContent = r.reasoning || ''; $('reasoningBox').hidden = !r.reasoning;
  $('raw').textContent = JSON.stringify({ request: r.request, response: r.response, error: r.error }, null, 2);
  const chosen = $('baseline').value;
  const candidates = state.records.filter(x => x.pointId === r.pointId && x.id !== r.id);
  $('baseline').innerHTML = candidates.length ? candidates.map(x => `<option value="${x.id}">${escape(new Date(x.startedAt).toLocaleString('zh-CN'))} · ${fmt(x.inputChars)} 字符 · ${escape(x.bookTitle || x.bookId || '未关联作品')} · ${escape(x.id.slice(0, 8))}</option>`).join('') : '<option value="">尚无同点位记录（可清除侧栏筛选后重试）</option>';
  if (candidates.some(x => x.id === chosen)) $('baseline').value = chosen;
}
async function select(id) {
  state.selected = id;
  const r = await api('calls/' + id);
  if (state.selected !== id) return;
  state.record = r; $('memo').value = localStorage.getItem('memo:' + id) || ''; $('diff').textContent = ''; state.diffText = '';
  drawList(); renderDetail(r);
}
async function refresh() {
  if (state.busy || state.paused) return;
  state.busy = true;
  try {
    const query = new URLSearchParams({ q: $('search').value, group: $('group').value, status: $('status').value, limit: state.limit });
    const result = await api('calls?' + query);
    const health = await api('status');
    if (health.client) {
      $('clientSource').hidden = false;
      const local = new URL(health.client.apiOrigin).hostname === '127.0.0.1';
      $('clientSource').textContent = local
        ? `客户端连接本地后端：${health.client.apiOrigin} · 请确认下方采集心跳；此处只显示本地记录。`
        : `客户端连接云端：${health.client.apiOrigin} · 云端采集尚未接通；以下是本机历史记录，不能代表当前云端生成。`;
    }
    $('source').textContent = health.collectors.length ? `正在采集 · ${health.collectors.map(c => c.environment + ' / ' + c.version).join('、')}` : '未检测到采集心跳 · 仅查阅历史记录';
    const captureErrors = health.collectors.filter(c => c.captureWarning);
    if (captureErrors.length) tell('采集写入异常：' + captureErrors.map(c => c.captureWarning).join('；'));
    state.records = result.records;
    $('count').textContent = fmt(result.total); $('totalInput').textContent = fmt(state.records.reduce((sum, r) => sum + r.inputChars, 0));
    $('running').textContent = state.records.filter(r => r.status === 'running').length;
    $('listHint').textContent = `显示 ${state.records.length} / ${result.count} 条 · 按操作分组`;
    $('more').hidden = state.records.length >= result.count || state.limit >= 1000;
    drawList(); drawMatrix();
    if (state.selected) {
      const summary = state.records.find(r => r.id === state.selected);
      if (summary?.updatedAt !== state.record?.updatedAt || summary?.status === 'running') {
        const selected = state.selected, r = await api('calls/' + selected);
        if (selected === state.selected) { state.record = r; renderDetail(r); }
      }
    } else if (state.records.length) await select(state.records[0].id);
    $('connection').textContent = '实时读取'; $('connection').className = 'pill';
  } catch (error) { $('connection').textContent = '连接中断'; $('connection').className = 'pill error'; tell(error.message); }
  finally { state.busy = false; }
}
function tabContent() {
  const r = state.record; if (!r) return '';
  if (state.tab === 'input') return messagesOf(r).map(m => `[${m.role}]\n${m.content}`).join('\n\n');
  if (state.tab === 'output') return r.output;
  if (state.tab === 'compare') return state.diffText || '尚未选择比较记录';
  return $('raw').textContent;
}
function diagnostic() {
  const r = state.record;
  return `# ALIPRO 模型请求诊断包\n\n点位：${r.pointId} / ${r.label}\n请求：${r.id}\n操作：${r.traceId}\n逻辑调用：${r.logicalCallId} / 发送尝试 ${r.attempt}\n时间：${r.startedAt}\n作品：${r.bookTitle || r.bookId} / 章节：${r.chapter}\n来源：${r.environment} / ${r.version} / ${r.source}\n源码指纹：${r.sourceHash}\n生成链路：${r.generationPipelineVersion || "旧版"} / ${r.generationPipelineHash || "未采集"}\n资料快照指纹：${r.sourceContextHash || "旧记录未采集"}\n上下文组合指纹：${r.contextHash || "旧记录未采集"}\n前章反馈有效性：${r.feedbackFreshness || "旧记录未采集"}\n模型：${r.request.model || r.provider}\n状态：${r.status}\n输入字符：${r.inputChars} / 输出字符：${r.outputChars}\n用量：${JSON.stringify(r.usage)}\n参数：${JSON.stringify(Object.fromEntries(Object.entries(r.request).filter(([k]) => !['messages','input','text'].includes(k))))}\n\n## 实际输入\n\n${messagesOf(r).map(m => `### ${m.role}\n${m.content}`).join('\n\n')}\n\n## 实际输出\n\n${r.output}\n\n## 错误\n${JSON.stringify(r.error)}\n\n## 对比记录\n${state.diffText || '未进行比较'}\n\n## 我的判断和修改要求\n${$('memo').value || '待补充'}\n`;
}
function lines(r) { return messagesOf(r).flatMap(m => [`[role:${m.role}]`, ...String(m.content).split(/\r?\n/)]); }
function difference(a, b) {
  const counts = new Map(); b.forEach(line => counts.set(line, (counts.get(line) || 0) + 1));
  return a.filter(line => { if (counts.get(line)) { counts.set(line, counts.get(line) - 1); return false; } return true; });
}
async function compare() {
  if (!$('baseline').value || !state.record) return;
  const current = state.record, before = await api('calls/' + $('baseline').value);
  if (current.id !== state.selected) return;
  const removed = difference(lines(before), lines(current)), added = difference(lines(current), lines(before));
  const delta = current.inputChars - before.inputChars;
  const heading = `基准 ${before.id.slice(0, 8)} → 当前 ${current.id.slice(0, 8)}：输入 ${fmt(before.inputChars)} → ${fmt(current.inputChars)} 字符，变化 ${delta >= 0 ? '+' : ''}${fmt(delta)}${before.inputChars ? '（' + (delta / before.inputChars * 100).toFixed(1) + '%）' : ''}`;
  const params = r => JSON.stringify(Object.fromEntries(Object.entries(r.request).filter(([k]) => !['messages', 'input', 'text'].includes(k))));
  const note = `模型/参数${params(before) === params(current) ? '相同' : '有变化'}；${before.sourceHash === current.sourceHash ? '源码点位指纹相同' : '源码点位指纹不同'}。文本行重排不会标为新增/删除，输入指纹${before.inputHash === current.inputHash ? '相同' : '不同'}。`;
  state.diffText = `${heading}\n${note}\n\n删除或减少的行：\n${removed.join('\n') || '无'}\n\n新增或增加的行：\n${added.join('\n') || '无'}`;
  $('diff').innerHTML = `<div class="warning">${escape(heading)}<br>${escape(note)}</div><div class="diff-grid"><div><h3>删除 / 减少 ${removed.length} 行</h3><pre class="removed">${escape(removed.join('\n') || '无')}</pre></div><div><h3>新增 / 增加 ${added.length} 行</h3><pre class="added">${escape(added.join('\n') || '无')}</pre></div></div>`;
}
$('calls').addEventListener('click', e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id) select(id).catch(e => tell(e.message)); });
$('chain').addEventListener('click', e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id) select(id).catch(e => tell(e.message)); });
$('tabs').addEventListener('click', e => {
  if (!e.target.dataset.tab) return; state.tab = e.target.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  ['input', 'output', 'compare', 'raw'].forEach(t => $(t + 'Panel').hidden = t !== state.tab);
});
$('pause').onclick = () => { state.paused = !state.paused; $('pause').textContent = state.paused ? '继续刷新' : '暂停刷新'; $('connection').textContent = state.paused ? '已暂停 · 仍在后台采集' : '实时读取'; refresh(); };
$('screenshot').onclick = () => { document.body.classList.toggle('capture'); $('screenshot').textContent = document.body.classList.contains('capture') ? '退出截图模式' : '截图模式'; };
$('matrixToggle').onclick = () => { $('matrix').hidden = !$('matrix').hidden; $('workspace').hidden = !$('matrix').hidden; $('matrixToggle').textContent = $('matrix').hidden ? '点位矩阵' : '返回调用记录'; };
$('copy').onclick = () => state.record && clipboard(diagnostic());
$('copyTab').onclick = () => clipboard(tabContent());
$('export').onclick = () => state.record && download(`${state.record.pointId}-${state.record.id}.json`, JSON.stringify({ ...state.record, userNotes: $('memo').value }, null, 2));
$('copyMatrix').onclick = () => clipboard('# 模型调用点位矩阵\n\n' + visibleMatrixCategories().map(c => `## ${c.label}\n\n${c.description}\n\n| 点位 | 阶段 | 入口/触发条件 | 输入 | 输出 | 重复机制 |\n|---|---|---|---|---|---|\n` + c.points.map(p => `| ${p.id} | ${p.label} | ${p.entry} | ${p.input} | ${p.output} | ${p.repeat} |`).join('\n')).join('\n\n'));
$('matrixCategories').onclick = event => {
  const category = event.target.closest('[data-category]')?.dataset.category;
  if (category) { state.matrixCategory = category; drawMatrix(); }
};
$('matrixSearch').oninput = drawMatrix;
$('matrixRows').addEventListener('toggle', event => {
  const el = event.target;
  if (!el.classList.contains('matrix-group')) return;
  if (el.open) state.matrixOpen.add(el.dataset.category); else state.matrixOpen.delete(el.dataset.category);
}, true);
function setMatrixOpen(open) {
  document.querySelectorAll('.matrix-group').forEach(el => {
    el.open = open;
    if (open) state.matrixOpen.add(el.dataset.category); else state.matrixOpen.delete(el.dataset.category);
  });
}
$('matrixExpand').onclick = () => setMatrixOpen(true);
$('matrixCollapse').onclick = () => setMatrixOpen(false);
$('compareButton').onclick = () => compare().catch(e => tell(e.message));
$('memo').oninput = () => { if (state.selected) localStorage.setItem('memo:' + state.selected, $('memo').value); };
['search', 'group', 'status'].forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { state.limit = 150; refresh(); }));
$('more').onclick = () => { state.limit += 150; refresh(); };
async function init() {
  try {
    const [info, matrix] = await Promise.all([api('status'), api('matrix')]);
    state.points = matrix.points; $('storage').textContent = info.dir;
    $('source').textContent = '本地采集目录 · 后端与观察台需使用同一目录';
    $('group').innerHTML += [...new Set(state.points.map(p => p.group))].map(group => `<option>${escape(group)}</option>`).join('');
    drawMatrix(); await refresh(); setInterval(refresh, 1000);
  } catch (error) { tell(error.message); $('connection').textContent = '连接失败'; }
}
init();
