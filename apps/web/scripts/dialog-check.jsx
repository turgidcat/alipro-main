import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MobileLibrarySurface from '../src/components/library/MobileLibrarySurface.jsx';
import Modal from '../src/components/workbench/Modal.jsx';
import '../src/styles.css';
import '../src/library-paper-polish.css';
import '../src/mobile.css';
import '../src/mobile-dialogs.css';

const longText = Array.from({ length: 36 }, (_, i) => `第${i + 1}段：角色追查线索，经历关键转折，作出新的选择。`).join('\n\n');
function Check() {
  const [page, setPage] = useState('outline');
  const [modal, setModal] = useState(false);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [aiCharacterOpen, setAiCharacterOpen] = useState(false);
  const [draft, setDraft] = useState({});
  return <><nav>{['outline', 'chapters', 'characters'].map(p => <button onClick={() => setPage(p)} key={p}>{p}</button>)}<button onClick={() => setModal(true)}>通用弹窗</button></nav><MobileLibrarySurface page={page} books={[]} onNavigate={() => {}} detailOutline={{ main_outline: longText, volume_outline: '分卷内容完整标记', detailed_outline: '详细大纲末尾标记' }} detailVolumePlans={[{ id: 'v', volume_number: 1, volume_name: '测试分卷', stage_goal: longText, notes: '分卷备注末尾标记' }]} volumePlanDrafts={{}} chapterEntries={[{ chapterNumber: 1, plan: { chapter_name: '测试章节', outline_text: longText + '\n章节细纲末尾标记' } }]} characterDrafts={{}} newCharacterDraft={draft} resetNewCharacterDraft={setDraft} creatingCharacter={creatingCharacter} setCreatingCharacter={setCreatingCharacter} aiCharacterOpen={aiCharacterOpen} setAiCharacterOpen={setAiCharacterOpen} aiRoleCounts={{}} setAiRoleCounts={() => {}} setAiCharacterHint={() => {}} handleCreateCharacter={() => setCreatingCharacter(false)} />{modal ? <Modal title="长内容通用弹窗" onClose={() => setModal(false)} actions={<button onClick={() => setModal(false)}>完成</button>}><p style={{ whiteSpace: 'pre-wrap' }}>{longText}\n通用弹窗末尾标记</p></Modal> : null}</>;
}
createRoot(document.getElementById('root')).render(<Check />);
