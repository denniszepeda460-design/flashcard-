import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import Home from './pages/Home';
import DeckView from './pages/DeckView';
import ReviewPage from './pages/ReviewPage';
import EditorPage from './pages/EditorPage';
import BrowserPage from './pages/BrowserPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';

import { useEffect } from 'react';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const theme = useSettingsStore(s => s.theme);
  
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deck/:deckId" element={<DeckView />} />
          <Route path="/review/:deckId" element={<ReviewPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:noteId" element={<EditorPage />} />
          <Route path="/browser" element={<BrowserPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

export default App;
