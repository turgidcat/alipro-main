import { useEffect, useMemo, useState } from 'react';
import {
  fetchBookList,
  fetchBookPlanningBundle,
  getStoredCurrentBookId,
  persistCurrentBookId
} from './workbenchApi.js';

const emptyPlanning = {
  currentBook: {
    id: '',
    title: '未命名书籍',
    author: '',
    description: '',
    coverImage: '',
    platform: '未设置平台',
    genre: '未设置题材',
    subgenre: '',
    template: '未设置模板',
    status: 'draft'
  },
  bookPlanning: {
    characterSummary: '先加载一本书，React 工作台就会把这本书的全书角色摘要带过来。',
    characterCountLabel: '待补角色摘要',
    outlineSummary: '先加载一本书，React 工作台就会把这本书的全书大纲摘要带过来。',
    outlineCountLabel: '待补全书大纲',
    volumePlans: [],
    characters: []
  }
};

export function useWorkbenchData() {
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(getStoredCurrentBookId());
  const [planningState, setPlanningState] = useState(emptyPlanning);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingPlanning, setLoadingPlanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function handleCurrentBookChange(event) {
      const nextBookId = event?.detail?.bookId ?? getStoredCurrentBookId();
      setSelectedBookId(nextBookId || '');
    }

    window.addEventListener('alipro:current-book-changed', handleCurrentBookChange);
    window.addEventListener('storage', handleCurrentBookChange);

    return () => {
      window.removeEventListener('alipro:current-book-changed', handleCurrentBookChange);
      window.removeEventListener('storage', handleCurrentBookChange);
    };
  }, []);

  async function loadPlanningByBookId(bookId) {
    if (!bookId) {
      setPlanningState(emptyPlanning);
      return;
    }

    setLoadingPlanning(true);
    setError('');

    try {
      const bundle = await fetchBookPlanningBundle(bookId);
      setPlanningState(bundle);
      persistCurrentBookId(bookId);
    } catch (loadError) {
      if (loadError.message === '书籍不存在') {
        setSelectedBookId('');
        persistCurrentBookId('');
        setPlanningState(emptyPlanning);
        setError('');
        return;
      }
      setError(`当前书籍加载失败：${loadError.message}`);
    } finally {
      setLoadingPlanning(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBooks() {
      setLoadingBooks(true);
      setError('');

      try {
        const list = await fetchBookList();
        if (cancelled) return;

        setBooks(list);

        if (!list.length) {
          setSelectedBookId('');
          persistCurrentBookId('');
          setPlanningState(emptyPlanning);
          return;
        }

        const storedId = getStoredCurrentBookId();
        if (storedId && list.some((book) => book.id === storedId)) {
          setSelectedBookId(storedId);
          return;
        }

        if (storedId) {
          persistCurrentBookId('');
        }
        setSelectedBookId('');
        setPlanningState(emptyPlanning);
      } catch (loadError) {
        if (cancelled) return;
        setError(`书籍列表读取失败：${loadError.message}`);
      } finally {
        if (!cancelled) {
          setLoadingBooks(false);
        }
      }
    }

    loadBooks();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadBooks(preferredBookId = '') {
    setLoadingBooks(true);
    setError('');

    try {
      const list = await fetchBookList();
      setBooks(list);

      if (!list.length) {
        setSelectedBookId('');
        persistCurrentBookId('');
        setPlanningState(emptyPlanning);
        return;
      }

      const storedId = preferredBookId || getStoredCurrentBookId();
      if (storedId && list.some((book) => book.id === storedId)) {
        persistCurrentBookId(storedId);
        setSelectedBookId(storedId);
        return;
      }

      if (storedId) {
        persistCurrentBookId('');
      }
      setSelectedBookId('');
      setPlanningState(emptyPlanning);
    } catch (loadError) {
      setError(`涔︾睄鍒楄〃璇诲彇澶辫触锛?{loadError.message}`);
    } finally {
      setLoadingBooks(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPlanning() {
      if (!selectedBookId) {
        setPlanningState(emptyPlanning);
        return;
      }
      await loadPlanningByBookId(selectedBookId);
      if (cancelled) return;
    }

    loadPlanning();
    return () => {
      cancelled = true;
    };
  }, [selectedBookId]);

  const currentBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || null,
    [books, selectedBookId]
  );

  return {
    books,
    currentBook,
    selectedBookId,
    setSelectedBookId,
    planningState,
    loadingBooks,
    loadingPlanning,
    error,
    reloadPlanning: loadPlanningByBookId,
    reloadBooks
  };
}
