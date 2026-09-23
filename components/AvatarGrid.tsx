'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConnectionTier } from '@/lib/tiers';

export type GridItem = {
  rowId: string;
  initials: string;
  name: string;
  tier?: ConnectionTier;
  photo?: string;
};

const TIER_CLASS: Record<ConnectionTier, string> = {
  tier1: 't1',
  tier2: 't2',
  tier3: 't3',
  funder: 'tpending',
  rejected: 'trej',
};

/**
 * Windowed on purpose. A real export is thousands of rows, and rendering every
 * tile while batches repaint makes the page stutter badly enough to look
 * broken. Only the visible band plus a margin is mounted.
 */
const TILE = 40;
const GAP = 4;
const OVERSCAN_ROWS = 6;

export default function AvatarGrid({
  items, selectedId, onSelect,
}: {
  items: GridItem[];
  selectedId?: string;
  onSelect: (rowId: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const perRow = Math.max(1, Math.floor((size.width + GAP) / (TILE + GAP)));
  const totalRows = Math.ceil(items.length / perRow);
  const firstRow = Math.max(0, Math.floor(scrollTop / (TILE + GAP)) - OVERSCAN_ROWS);
  const visibleRows = Math.ceil(size.height / (TILE + GAP)) + OVERSCAN_ROWS * 2;
  const start = firstRow * perRow;
  const end = Math.min(items.length, start + visibleRows * perRow);
  const slice = items.slice(start, end);

  return (
    <div
      ref={box}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      className="relative h-full overflow-y-auto"
    >
      <div style={{ height: totalRows * (TILE + GAP) }}>
        <div
          className="absolute left-0 right-0 flex flex-wrap"
          style={{ top: firstRow * (TILE + GAP), gap: GAP }}
        >
          {slice.map((it) => (
            <button
              key={it.rowId}
              onClick={() => onSelect(it.rowId)}
              title={it.name}
              aria-label={it.name}
              className={`flex items-center justify-center text-[10px] font-semibold transition ${
                it.tier ? TIER_CLASS[it.tier] : 'tpending'
              } ${selectedId === it.rowId ? 'outline outline-2 outline-offset-1' : ''}`}
              style={{ width: TILE, height: TILE, outlineColor: 'var(--accent)' }}
            >
              {it.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                it.initials
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
