import { useEffect, useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath, scaleSqrt } from 'd3';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import type { GeoLink } from '@/data/aggregates';
import type { Company } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { formatCompanyCap } from '@/lib/format';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

export interface WorldFlowMapProps {
  companies: Company[];
  links: GeoLink[];
  tokens: ThemeTokens;
  onSelect?: (id: string) => void;
  height?: number;
}

let landPromise: Promise<FeatureCollection<Geometry>> | null = null;
function loadLand() {
  landPromise ??= import('world-atlas/land-110m.json').then((m) => {
    const topo = (m.default ?? m) as unknown as Topology;
    return feature(topo, topo.objects.land) as unknown as FeatureCollection<Geometry>;
  });
  return landPromise;
}

/** HQ locations (dot = market cap, color = sector) with great-circle arcs for cross-border links. */
export function WorldFlowMap({ companies, links, tokens, onSelect, height = 440 }: WorldFlowMapProps) {
  const [ref, { width }] = useElementSize();
  const [land, setLand] = useState<FeatureCollection<Geometry> | null>(null);
  const [hover, setHover] = useState<{ c: Company; x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadLand().then((l) => live && setLand(l));
    return () => {
      live = false;
    };
  }, []);

  const projection = useMemo(() => {
    // Centered on North America: most links run US↔Asia across the Pacific and US↔Europe
    // across the Atlantic, so the map seam falls over Central Asia where few arcs cross.
    // Fit to where companies are (padded) rather than the whole globe, so empty oceans don't eat the frame.
    const pad: [number, number][] = companies.flatMap((c) => [
      [c.hq.lng - 25, Math.min(80, c.hq.lat + 22)],
      [c.hq.lng + 25, Math.max(-60, c.hq.lat - 22)],
    ]);
    const target = pad.length ? { type: 'MultiPoint' as const, coordinates: pad } : { type: 'Sphere' as const };
    return geoNaturalEarth1().rotate([115, 0]).fitExtent([[0, 0], [Math.max(width, 16), height]], target);
  }, [width, height, companies]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const r = scaleSqrt().domain([0, Math.max(...companies.map((c) => c.marketCap), 1)]).range([1.5, 11]);

  // Draw big companies first so small ones stay on top and hoverable.
  const dots = useMemo(() => [...companies].sort((a, b) => b.marketCap - a.marketCap), [companies]);
  const hoverLinks = hover ? new Set(links.filter((l) => l.source.id === hover.c.id || l.target.id === hover.c.id)) : null;

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} style={{ overflow: 'hidden', borderRadius: 8 }} role="img" aria-label="World map of headquarters and cross-border relationships">
          <path d={path({ type: 'Sphere' }) ?? ''} fill={tokens.bg.inset} />
          <path d={path(geoGraticule10()) ?? ''} fill="none" stroke={tokens.viz.grid} />
          {land && <path d={path(land) ?? ''} fill={tokens.bg.surface3} stroke={tokens.border.default} strokeWidth={0.5} />}
          <g fill="none" strokeLinecap="round">
            {links.map((l, i) => {
              const on = !hoverLinks || hoverLinks.has(l);
              return (
                <path
                  key={i}
                  d={path({ type: 'LineString', coordinates: [[l.source.hq.lng, l.source.hq.lat], [l.target.hq.lng, l.target.hq.lat]] }) ?? ''}
                  stroke={on && hoverLinks ? tokens.text.primary : tokens.viz.edgeStrong}
                  strokeOpacity={on ? (hoverLinks ? 0.9 : 0.1 + l.weight * 0.25) : 0.04}
                  strokeWidth={0.5 + l.weight * 1.1}
                  className={styles.mark}
                />
              );
            })}
          </g>
          {dots.map((c) => {
            const p = projection([c.hq.lng, c.hq.lat]);
            if (!p) return null;
            return (
              <circle
                key={c.id}
                cx={p[0]}
                cy={p[1]}
                r={r(c.marketCap)}
                fill={sectorColor(c.sector, tokens)}
                fillOpacity={0.85}
                stroke={tokens.bg.surface1}
                strokeWidth={1}
                style={{ cursor: onSelect ? 'pointer' : undefined }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({ c, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onClick={() => onSelect?.(c.id)}
              />
            );
          })}
        </svg>
      )}
      {hover && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          containerWidth={width}
          title={hover.c.shortName}
          rows={[
            { label: `${hover.c.hq.city}, ${hover.c.hq.countryCode}`, value: '', color: sectorColor(hover.c.sector, tokens) },
            { label: 'Market cap', value: formatCompanyCap(hover.c) },
            { label: 'Cross-border links', value: hoverLinks?.size ?? 0 },
          ]}
        />
      )}
    </div>
  );
}
