'use client';

import type { LoadedFile } from './Upload';

/** After upload the slots collapse to this, with Replace on each side. */
export default function UploadBar({
  connections, invitations, connectionCount, invitationCount, onReplace,
}: {
  connections: LoadedFile | null;
  invitations: LoadedFile | null;
  connectionCount: number;
  invitationCount: number;
  onReplace: (which: 'connections' | 'invitations') => void;
}) {
  const Item = ({
    file, count, which,
  }: { file: LoadedFile | null; count: number; which: 'connections' | 'invitations' }) => (
    <div className="flex items-baseline gap-2">
      <span className="label">{which}</span>
      {file ? (
        <>
          <span className="text-sm">{file.name}</span>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {count.toLocaleString()} rows
          </span>
          <button
            onClick={() => onReplace(which)}
            className="text-xs underline"
            style={{ color: 'var(--muted)' }}
          >
            Replace
          </button>
        </>
      ) : (
        <button onClick={() => onReplace(which)} className="text-sm underline">
          Add
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <Item file={connections} count={connectionCount} which="connections" />
      <Item file={invitations} count={invitationCount} which="invitations" />
    </div>
  );
}
