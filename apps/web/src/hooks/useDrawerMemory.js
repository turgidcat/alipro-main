import { useEffect } from 'react';

const DRAWER_MEMORY_PREFIX = 'alipro-workbench-drawer';

function getDrawerMemoryKey(bookId, chapterNumber) {
  if (!bookId) return '';
  return `${DRAWER_MEMORY_PREFIX}:${bookId}:${Number(chapterNumber || 1)}`;
}

export function useDrawerMemory({
  bookId,
  chapterNumber,
  activeDrawer,
  setActiveDrawer
}) {
  const drawerMemoryKey = getDrawerMemoryKey(bookId, chapterNumber);

  useEffect(() => {
    if (!drawerMemoryKey) {
      setActiveDrawer(null);
      return;
    }

    let nextDrawer = null;
    try {
      const raw = window.localStorage.getItem(drawerMemoryKey);
      nextDrawer = raw || null;
    } catch (_) {
      nextDrawer = null;
    }
    setActiveDrawer(nextDrawer);
  }, [drawerMemoryKey, setActiveDrawer]);

  useEffect(() => {
    if (!drawerMemoryKey) return;
    try {
      if (activeDrawer) {
        window.localStorage.setItem(drawerMemoryKey, activeDrawer);
      } else {
        window.localStorage.removeItem(drawerMemoryKey);
      }
    } catch (_) {}
  }, [activeDrawer, drawerMemoryKey]);
}
