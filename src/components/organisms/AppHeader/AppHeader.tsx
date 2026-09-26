import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { BrandMark, IconButton, Tooltip } from '../../atoms';
import { SearchField, type SearchItem } from '../../molecules';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  searchItems: SearchItem[];
  onSearchSelect: (id: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/insights', label: 'Insights' },
  { to: '/lenses', label: 'Lenses' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/data', label: 'Data' },
];

export function AppHeader({ searchItems, onSearchSelect, theme, onToggleTheme }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/" className={styles.brand} aria-label="RelationshipViz home">
          <BrandMark />
          <span className={styles.wordmark}>
            Relationship<span className={styles.wordmarkAccent}>Viz</span>
          </span>
        </NavLink>
        <nav aria-label="Primary" className={styles.nav}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className={styles.search}>
        <SearchField items={searchItems} onSelect={onSearchSelect} placeholder={`Search ${searchItems.length} companies…`} />
      </div>
      <div className={styles.right}>
        <Tooltip content={theme === 'dark' ? 'Light theme' : 'Dark theme'} side="left">
          <IconButton icon={theme === 'dark' ? Sun : Moon} label="Toggle theme" onClick={onToggleTheme} />
        </Tooltip>
      </div>
    </header>
  );
}
