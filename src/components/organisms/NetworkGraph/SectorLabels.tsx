import { useEffect, useState } from 'react';
import { useSigma } from '@react-sigma/core';
import type { SectorCluster } from '@/lib/graph/layouts';
import styles from './NetworkGraph.module.css';

/** HTML labels pinned above each sector cluster; repositioned on every camera render. */
export function SectorLabels({ clusters, onPick }: { clusters: SectorCluster[]; onPick: (s: SectorCluster['sector']) => void }) {
  const sigma = useSigma();
  const [pos, setPos] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setPos(clusters.map((c) => sigma.graphToViewport({ x: c.x, y: c.y + c.radius + 4 }))),
      );
    };
    update();
    sigma.on('afterRender', update);
    return () => {
      cancelAnimationFrame(raf);
      sigma.off('afterRender', update);
    };
  }, [sigma, clusters]);

  return (
    <div className={styles.sectorLabels} aria-hidden>
      {clusters.map((c, i) =>
        pos[i] ? (
          <button
            key={c.sector}
            type="button"
            tabIndex={-1}
            className={styles.sectorLabel}
            style={{ transform: `translate(${pos[i].x}px, ${pos[i].y}px) translate(-50%, -100%)` }}
            onClick={() => onPick(c.sector)}
          >
            {c.sector}
          </button>
        ) : null,
      )}
    </div>
  );
}
