'use client';

import React from 'react';

// --- Inline markdown renderer (no external dependency) ---

type Block =
  | { type: 'heading'; text: string }
  | { type: 'hr' }
  | { type: 'bullet'; items: Inline[][] }
  | { type: 'paragraph'; inlines: Inline[] };

type Inline =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'math_inline'; value: string }
  | { type: 'math_block'; value: string };

function parseInlines(raw: string): Inline[] {
  const result: Inline[] = [];
  // Match \[...\] (block math), \(...\) (inline math), **bold**, *italic*
  const re = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) result.push({ type: 'text', value: raw.slice(last, m.index) });
    if (m[1] !== undefined) result.push({ type: 'math_block', value: m[1].trim() });
    else if (m[2] !== undefined) result.push({ type: 'math_inline', value: m[2].trim() });
    else if (m[3] !== undefined) result.push({ type: 'bold', value: m[4] });
    else result.push({ type: 'italic', value: m[6] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) result.push({ type: 'text', value: raw.slice(last) });
  return result;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) { i++; continue; }

    // HR
    if (/^---+$/.test(trimmed)) { blocks.push({ type: 'hr' }); i++; continue; }

    // Heading: ## or ### or **N. Title** pattern
    if (/^#{1,3} /.test(trimmed)) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#{1,3} /, '') });
      i++; continue;
    }
    // Bold-only line used as heading by Mistral: **1. Synthèse générale**
    if (/^\*\*\d+\.\s+.+\*\*$/.test(trimmed)) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^\*\*|\*\*$/g, '') });
      i++; continue;
    }

    // Numbered list: treat as bullet
    if (/^\d+\. /.test(trimmed)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(parseInlines(lines[i].trim().replace(/^\d+\. /, '')));
        i++;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Bullet list: collect consecutive bullet lines
    if (/^[-*] /.test(trimmed)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(parseInlines(lines[i].trim().replace(/^[-*] /, '')));
        i++;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Paragraph: collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^#{1,3} /.test(lines[i].trim()) &&
      !/^\*\*\d+\.\s+.+\*\*$/.test(lines[i].trim()) &&
      !/^[-*] /.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', inlines: parseInlines(paraLines.join(' ')) });
    }
  }
  return blocks;
}

function renderInlines(inlines: Inline[], key?: string): React.ReactNode {
  return inlines.map((node, idx) => {
    const k = `${key ?? ''}-${idx}`;
    if (node.type === 'bold') return <strong key={k} style={{ fontWeight: 700, color: '#1e1b4b' }}>{node.value}</strong>;
    if (node.type === 'italic') return <em key={k} style={{ fontStyle: 'italic', color: '#4338ca' }}>{node.value}</em>;
    if (node.type === 'math_inline') return (
      <code key={k} style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', background: '#f0f4ff', padding: '0.05em 0.3em', borderRadius: '0.25em', fontSize: '0.95em', color: '#312e81' }}>
        {node.value}
      </code>
    );
    if (node.type === 'math_block') return (
      <div key={k} style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', background: '#f0f4ff', padding: '0.5em 1em', borderRadius: '0.375em', margin: '0.75em 0', textAlign: 'center', fontSize: '1em', color: '#312e81', overflowX: 'auto' }}>
        {node.value}
      </div>
    );
    return <React.Fragment key={k}>{node.value}</React.Fragment>;
  });
}

function renderBlocks(blocks: Block[]): React.ReactNode {
  return blocks.map((block, idx) => {
    if (block.type === 'hr') {
      return <hr key={idx} style={{ border: 'none', borderTop: '1px solid #e0e7ff', margin: '1.5rem 0' }} />;
    }
    if (block.type === 'heading') {
      return (
        <div key={idx} style={{
          fontSize: '1.0625rem',
          fontWeight: 700,
          color: '#312e81',
          marginTop: '1.75rem',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '2px solid #e0e7ff',
          lineHeight: 1.4,
        }}>
          {renderInlines(parseInlines(block.text), `h-${idx}`)}
        </div>
      );
    }
    if (block.type === 'bullet') {
      return (
        <ul key={idx} style={{ paddingLeft: '1.5rem', marginBottom: '1rem', marginTop: '0.25rem' }}>
          {block.items.map((item, j) => (
            <li key={j} style={{
              fontSize: '0.9375rem',
              color: '#374151',
              lineHeight: 1.8,
              marginBottom: '0.375rem',
              listStyleType: 'disc',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}>
              {renderInlines(item, `li-${idx}-${j}`)}
            </li>
          ))}
        </ul>
      );
    }
    if (block.type === 'paragraph') {
      return (
        <p key={idx} style={{
          fontSize: '0.9375rem',
          color: '#374151',
          lineHeight: 1.85,
          marginBottom: '0.875rem',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}>
          {renderInlines(block.inlines, `p-${idx}`)}
        </p>
      );
    }
    return null;
  });
}

// --- Component ---

export default function BilanParentPreview({ bilanText }: { bilanText: string }) {
  if (!bilanText) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #f3f4f6' }}>
      Aucune synthèse générée pour le moment.
    </div>
  );

  const blocks = parseBlocks(bilanText);

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 24px rgba(99,102,241,0.06)',
      border: '1px solid #e0e7ff',
      padding: '2.5rem 3rem',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      minWidth: 0,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e0e7ff' }}>
        <img
          src="/images/logo_slogan_nexus.png"
          alt="Nexus Réussite"
          style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
        />
        <span style={{ padding: '0.3rem 1rem', background: '#fffbeb', color: '#92400e', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '999px', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          Confidentiel
        </span>
      </div>

      {/* Rendered content */}
      <div style={{ width: '100%', minWidth: 0 }}>
        {renderBlocks(blocks)}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e0e7ff', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.6 }}>
        Ce document a été rédigé par l&apos;équipe pédagogique Nexus Réussite.<br />
        Strictement confidentiel et à usage exclusif des parents de l&apos;élève.
      </div>
    </div>
  );
}
