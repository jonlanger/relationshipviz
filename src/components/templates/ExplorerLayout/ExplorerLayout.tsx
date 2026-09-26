import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './ExplorerLayout.module.css';

export interface ExplorerLayoutProps {
  sidebar: ReactNode;
  sidebarOpen: boolean;
  canvas: ReactNode;
  /** Floating toolbar over the top of the canvas. */
  toolbar?: ReactNode;
  /** Right-hand detail drawer; becomes a bottom sheet on narrow screens. */
  drawer?: ReactNode;
}

export function ExplorerLayout({ sidebar, sidebarOpen, canvas, toolbar, drawer }: ExplorerLayoutProps) {
  return (
    <div className={clsx(styles.layout, sidebarOpen && styles.withSidebar, drawer && styles.withDrawer)}>
      <aside className={styles.sidebar} aria-label="Filters and view options" hidden={!sidebarOpen}>
        {sidebar}
      </aside>
      <main className={styles.canvas}>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        {canvas}
      </main>
      <div className={clsx(styles.drawer, drawer && styles.drawerOpen)}>{drawer}</div>
    </div>
  );
}
