/**
 * toolCursors.ts
 * Curseur SVG personnalisé et contrasté selon l'outil actif du Piano Roll.
 */
import type { PianoRollTool } from '../components/livret-melodia/pianoRollInteractions';

const CURSOR_SVGS: Record<string, { svg: string; x: number; y: number }> = {
  draw_move: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M1 1 L18 8 L11 11 L8 18 Z" fill="%239a3412" stroke="%23ffffff" stroke-width="1.5"/><circle cx="1" cy="1" r="1.2" fill="%23ffffff"/></svg>',
    x: 1, y: 1,
  },
  erase: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="6" width="16" height="11" rx="2" transform="rotate(-30 11 11)" fill="%23e11d48" stroke="%23ffffff" stroke-width="1.5"/><line x1="8" y1="5" x2="8" y2="16" stroke="%23ffffff" stroke-width="1.5" transform="rotate(-30 11 11)"/></svg>',
    x: 8, y: 8,
  },
  split: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3" fill="none" stroke="%23f59e0b" stroke-width="1.8"/><circle cx="6" cy="16" r="3" fill="none" stroke="%23f59e0b" stroke-width="1.8"/><path d="M8.5 7.5 L19 17 M8.5 14.5 L19 5" stroke="%23ffffff" stroke-width="2" stroke-linecap="round"/></svg>',
    x: 10, y: 10,
  },
  paste: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="5" width="15" height="16" rx="1" fill="%230f766e" stroke="%23ffffff" stroke-width="1.5"/><rect x="8" y="2" width="7" height="4" rx="1" fill="%23ffffff"/><line x1="7" y1="10" x2="16" y2="10" stroke="%23ffffff" stroke-width="1.5"/><line x1="7" y1="14" x2="14" y2="14" stroke="%23ffffff" stroke-width="1.5"/></svg>',
    x: 4, y: 4,
  },
  lyric: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 21 L8 18 L20 6 C21 5 21 3 19 2 C18 1 16 1 15 2 L3 14 Z" fill="%233b82f6" stroke="%23ffffff" stroke-width="1.5"/><line x1="13" y1="4" x2="18" y2="9" stroke="%23ffffff" stroke-width="1.2"/><circle cx="3" cy="21" r="1.5" fill="%23f59e0b"/></svg>',
    x: 3, y: 21,
  },
  melodyne_cut: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22" stroke="%2338bdf8" stroke-width="2" stroke-dasharray="2,2"/><circle cx="5" cy="6" r="2.8" fill="none" stroke="%23f59e0b" stroke-width="1.5"/><circle cx="5" cy="18" r="2.8" fill="none" stroke="%23f59e0b" stroke-width="1.5"/><path d="M7 8 L18 19 M7 16 L18 5" stroke="%23ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    x: 12, y: 12,
  },
};

const TOOL_ALIAS_MAP: Record<PianoRollTool, string> = {
  draw_move: 'draw_move',
  pointer: 'draw_move',
  erase: 'erase',
  split: 'split',
  cut: 'split',
  paste: 'paste',
  glue: 'paste',
  lyric: 'lyric',
  text: 'lyric',
  melodyne_cut: 'melodyne_cut',
};


export function getToolCursorStyle(activeTool: PianoRollTool): string {
  const key = TOOL_ALIAS_MAP[activeTool] ?? 'draw_move';
  const def = CURSOR_SVGS[key];
  if (!def) return 'crosshair';
  return `url("data:image/svg+xml;utf8,${def.svg}") ${def.x} ${def.y}, crosshair`;
}
