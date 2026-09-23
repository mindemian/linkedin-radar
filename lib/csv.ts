'use client';

import Papa from 'papaparse';

/** Client-side download. A BOM keeps accented names readable in Excel. */
export function downloadCsv(filename: string, rows: Record<string, string>[], columns: string[]) {
  const csv = Papa.unparse(rows, { columns });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
