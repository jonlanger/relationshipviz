/** RelationshipViz mark: three linked nodes of descending weight. Uses currentColor + accent. */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 17.5 12 6l6 11.5H6Z" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="6" r="3.5" fill="var(--color-accent-default)" />
      <circle cx="6" cy="17.5" r="2.75" fill="currentColor" />
      <circle cx="18" cy="17.5" r="2" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}
