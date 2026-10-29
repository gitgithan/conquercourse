import React from 'react';
import { TAG_TEXT, type ShotTag } from '../lib/tags';

// A small corner tag that says what the shot is; META names the model, "processed earlier" and "sped up" are extra notes.
export const Tag: React.FC<{ tag: ShotTag; model?: string; note?: string }> = ({ tag, model, note }) => (
  <div style={{ position: 'absolute', left: 24, top: 20, font: '600 20px system-ui', color: '#fff', background: 'rgba(17,17,17,.7)', padding: '4px 12px', borderRadius: 4 }}>
    {tag} · {tag === 'META' && model ? `${TAG_TEXT[tag]}: ${model}` : TAG_TEXT[tag]}{note ? ` · ${note}` : ''}
  </div>
);
