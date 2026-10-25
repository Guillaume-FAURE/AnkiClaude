import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useApplyTheme } from './lib/theme';
import Home from './pages/Home';
import DeckPage from './pages/DeckPage';
import DeckForm from './pages/DeckForm';
import Review from './pages/Review';

// These pages pull in the Anthropic SDK: load them on demand.
const CardForm = lazy(() => import('./pages/CardForm'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Account = lazy(() => import('./pages/Account'));

export default function App() {
  useApplyTheme();
  return (
    <HashRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deck/new" element={<DeckForm />} />
          <Route path="/deck/:id" element={<DeckPage />} />
          <Route path="/deck/:id/edit" element={<DeckForm />} />
          <Route path="/review" element={<Review />} />
          <Route path="/deck/:id/review" element={<Review />} />
          <Route path="/card/new" element={<CardForm />} />
          <Route path="/card/:id" element={<CardForm />} />
          <Route path="/ai" element={<Assistant />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
