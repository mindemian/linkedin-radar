'use client';

import { useRef } from 'react';
import type { LoadedFile } from './Upload';

/**
 * After upload the slots collapse to this. Both Add and Replace open a real
 * file picker: clearing the slot and hoping the user finds their way back to
 * the empty state is not the same thing, and it left the second file
 * unreachable.
 */
export default function UploadBar({
  connections, invitations, connectionCount, invitationCount, onFile,
}: {
  connections: LoadedFile | null;
  invitations: LoadedFile | null;
  connectionCount: number;
  invitationCount: number;
  onFile: (file: File, slot: 'connections' | 'invitations') => void;
}) {
  const connInput = useRef<HTMLInputElement>(null);
  const invInput = useRef<HTMLInputElement>(null);

  const Item = ({
    file, count, which, input,
  }: {
    file: LoadedFile | null;
    count: number;
    which: 'connections' | 'invitations';
    input: React.RefObject<HTMLInputElement | null>;
  }) => (
    <div className="flex items-baseline gap-2">
      <span className="label">{which}</span>
      {file ? (
        <>
          <span className="text-sm">{file.name}</span>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {count.toLocaleString()} rows
          </span>
        </>
      ) : (
        <span className="text-sm" style={{ color: 'var(--muted)' }}>not loaded</span>
      )}
      <button onClick={() => input.current?.click()} className="text-xs underline" style={{ color: 'var(--muted)' }}>
        {file ? 'Replace' : 'Add'}
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label={`${which} file`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f, which);
          e.target.value = '';
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <Item file={connections} count={connectionCount} which="connections" input={connInput} />
      <Item file={invitations} count={invitationCount} which="invitations" input={invInput} />
    </div>
  );
}
