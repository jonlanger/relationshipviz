import { useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '@/design-system';
import { sectorColor } from '@/lib/colors';
import { AppHeader, ErrorBoundary } from '@/components/organisms';
import { Button, Spinner, Text } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import { useAppStore, useDataset } from './store';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { dataset, status, error } = useDataset();
  const { name, tokens, toggle } = useTheme();
  const select = useAppStore((s) => s.select);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const searchItems = useMemo(
    () =>
      dataset?.companies.map((c) => ({
        id: c.id,
        ticker: c.ticker ?? c.shortName,
        label: c.shortName,
        sublabel: `${c.industry} · ${c.hq.countryCode}`,
        color: sectorColor(c.sector, tokens),
        keywords: [c.name, ...c.aliases],
      })) ?? [],
    [dataset, tokens],
  );

  const onSearchSelect = useCallback(
    (id: string) => {
      select(id);
      navigate('/explore');
    },
    [select, navigate],
  );

  return (
    <div className={styles.app}>
      <a href="#content" className={styles.skip}>
        Skip to content
      </a>
      <AppHeader
        searchItems={searchItems}
        onSearchSelect={onSearchSelect}
        theme={name}
        onToggleTheme={toggle}
      />
      <div id="content" className={styles.content}>
        {status === 'error' ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the dataset"
            description={error}
            action={<Button onClick={() => window.location.reload()}>Retry</Button>}
          />
        ) : !dataset ? (
          <div className={styles.loading} role="status">
            <Spinner />
            <Text variant="bodySm" tone="secondary">
              Loading relationship data…
            </Text>
          </div>
        ) : (
          <ErrorBoundary label="this page" resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
