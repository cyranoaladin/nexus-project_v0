import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1e1b4b', marginTop: '2rem', marginBottom: '0.75rem', lineHeight: 1.3 }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#312e81', marginTop: '1.75rem', marginBottom: '0.5rem', lineHeight: 1.4, borderBottom: '1px solid #e0e7ff', paddingBottom: '0.375rem' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#3730a3', marginTop: '1.25rem', marginBottom: '0.4rem' }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.8, marginBottom: '0.875rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: '#1e1b4b' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic', color: '#4338ca' }}>{children}</em>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: '1.5rem', marginBottom: '0.875rem', listStyleType: 'disc' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: '1.5rem', marginBottom: '0.875rem', listStyleType: 'decimal' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.75, marginBottom: '0.25rem', wordBreak: 'break-word' }}>
      {children}
    </li>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid #e0e7ff', margin: '1.5rem 0' }} />
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid #6366f1', paddingLeft: '1rem', marginLeft: 0, color: '#4338ca', fontStyle: 'italic', margin: '1rem 0' }}>
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code style={{ background: '#f1f5f9', padding: '0.1em 0.4em', borderRadius: '4px', fontSize: '0.875em', color: '#1e293b' }}>
      {children}
    </code>
  ),
};

export default function BilanParentPreview({ bilanText }: { bilanText: string }) {
  if (!bilanText) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #f3f4f6' }}>
      Aucune synthèse générée pour le moment.
    </div>
  );

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
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid #e0e7ff' }}>
        <img
          src="/images/logo_slogan_nexus.png"
          alt="Nexus Réussite"
          style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
        />
        <span style={{ padding: '0.3rem 1rem', background: '#fffbeb', color: '#92400e', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '999px', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          Confidentiel
        </span>
      </div>

      {/* Markdown content */}
      <div style={{ width: '100%', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {bilanText}
        </ReactMarkdown>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e0e7ff', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.6 }}>
        Ce document a été rédigé par l&apos;équipe pédagogique Nexus Réussite.<br />
        Strictement confidentiel et à usage exclusif des parents de l&apos;élève.
      </div>
    </div>
  );
}
