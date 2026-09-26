import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/design-system';
import { ExplorePage } from '@/pages/ExplorePage';
import { AppLayout } from './AppLayout';

// Chart-heavy pages load on demand.
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const InsightsPage = lazy(() => import('@/pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const CompanyPage = lazy(() => import('@/pages/CompanyPage').then((m) => ({ default: m.CompanyPage })));
const LensesPage = lazy(() => import('@/pages/LensesPage').then((m) => ({ default: m.LensesPage })));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })));
const IdeasPage = lazy(() => import('@/pages/IdeasPage').then((m) => ({ default: m.IdeasPage })));
const AboutDataPage = lazy(() => import('@/pages/AboutDataPage').then((m) => ({ default: m.AboutDataPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="lenses" element={<LensesPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="ideas" element={<IdeasPage />} />
              <Route path="company/:id" element={<CompanyPage />} />
              <Route path="data" element={<AboutDataPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
