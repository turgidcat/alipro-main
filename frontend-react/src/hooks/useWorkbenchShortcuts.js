import { useEffect } from 'react';

function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tagName = String(target.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return Boolean(target.isContentEditable);
}

export function useWorkbenchShortcuts({
  activeDrawer,
  chapterModal,
  planningModal,
  promptPreviewOpen,
  resultModalOpen,
  handleCloseDrawer,
  handleGenerateWithGuards,
  goToNextChapter,
  goToPreviousChapter,
  setChapterModal,
  setPlanningModal,
  setPromptPreviewOpen,
  setResultModalOpen
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      const typing = isTypingTarget(event.target);
      const hasBlockingModal = Boolean(chapterModal || resultModalOpen || promptPreviewOpen || planningModal);

      if (event.key === 'Escape') {
        if (promptPreviewOpen) {
          event.preventDefault();
          setPromptPreviewOpen(false);
          return;
        }
        if (resultModalOpen) {
          event.preventDefault();
          setResultModalOpen(false);
          return;
        }
        if (chapterModal) {
          event.preventDefault();
          setChapterModal(null);
          return;
        }
        if (planningModal) {
          event.preventDefault();
          setPlanningModal(null);
          return;
        }
        if (activeDrawer) {
          event.preventDefault();
          handleCloseDrawer();
        }
        return;
      }

      if (typing || hasBlockingModal) return;

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        handleGenerateWithGuards();
        return;
      }

      if (event.key === '[') {
        event.preventDefault();
        goToPreviousChapter();
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        goToNextChapter();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeDrawer,
    chapterModal,
    goToNextChapter,
    goToPreviousChapter,
    handleCloseDrawer,
    handleGenerateWithGuards,
    planningModal,
    promptPreviewOpen,
    resultModalOpen,
    setChapterModal,
    setPlanningModal,
    setPromptPreviewOpen,
    setResultModalOpen
  ]);
}
