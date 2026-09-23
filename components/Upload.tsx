'use client';

import { useRef, useState } from 'react';
import { expectedColumnsMessage, identify, type FileKind } from '@/lib/parse/detect';

export type LoadedFile = {
  kind: Exclude<FileKind, 'unknown'>;
  name: string;
  text: string;
  /** Set when the file was dropped in the other slot and we moved it. */
  movedFrom?: string;
};

type Props = {
  connections: LoadedFile | null;
  invitations: LoadedFile | null;
  onLoad: (f: LoadedFile) => void;
  onReject: (message: string) => void;
};

const HOWTO = [
  'LinkedIn → Settings → Data privacy',
  'Get a copy of your data → pick the files you want',
  'Download the archive when the email arrives, then drop the CSV here',
];

function Slot({
  title, wanted, loaded, onFile,
}: {
  title: string;
  wanted: Exclude<FileKind, 'unknown'>;
  loaded: LoadedFile | null;
  onFile: (file: File, slot: Exclude<FileKind, 'unknown'>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="flex-1">
      <div className="label mb-2">{title}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f, wanted);
        }}
        onClick={() => input.current?.click()}
        className={`panel cursor-pointer p-8 text-center transition ${
          over ? 'border-[var(--accent)]' : ''
        } ${loaded ? 'border-solid' : 'border-dashed'}`}
        style={{ borderWidth: 1 }}
      >
        {loaded ? (
          <>
            <div className="serif text-lg">{loaded.name}</div>
            <div className="label mt-1">loaded</div>
          </>
        ) : (
          <>
            <div className="serif text-lg">Drop {title}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              or click to choose
            </div>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f, wanted);
            e.target.value = '';
          }}
        />
      </div>
      <ol className="mt-3 space-y-0.5 text-xs" style={{ color: 'var(--muted)' }}>
        {HOWTO.map((line, i) => (
          <li key={i}>{i + 1}. {line}</li>
        ))}
      </ol>
    </div>
  );
}

export default function Upload({ connections, invitations, onLoad, onReject }: Props) {
  const handle = async (file: File, slot: Exclude<FileKind, 'unknown'>) => {
    const text = await file.text();
    const kind = identify(text);

    if (kind === 'unknown') {
      onReject(expectedColumnsMessage());
      return;
    }
    // Identification is by header, never by filename, so a file in the wrong
    // slot is simply routed to the right one and the move is announced.
    onLoad({
      kind,
      name: file.name,
      text,
      ...(kind !== slot ? { movedFrom: slot } : {}),
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="serif text-5xl leading-none">LinkedIn Radar</h1>
      <p className="mt-4 max-w-xl text-sm" style={{ color: 'var(--muted)' }}>
        Drop your own LinkedIn exports. They are read in this browser and never
        uploaded; only the few fields your questions ask about are sent for scoring.
        Either file works on its own.
      </p>

      <div className="mt-10 flex flex-col gap-8 sm:flex-row">
        <Slot title="Connections.csv" wanted="connections" loaded={connections} onFile={handle} />
        <Slot title="Invitations.csv" wanted="invitations" loaded={invitations} onFile={handle} />
      </div>
    </div>
  );
}
