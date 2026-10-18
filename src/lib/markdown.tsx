import React from 'react';

/**
 * Minimal, safe Markdown for lesson bodies (SPEC: lessons have a markdown body).
 * Supports headings (#, ##, ###), bullet and numbered lists, paragraphs,
 * **bold**, *italic* and [links](https://...). It builds React elements and
 * never injects HTML, so lesson text cannot run scripts. Only https links work.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return /^https:\/\//i.test(href) ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700">
          {label}
        </a>
      ) : (
        <span key={key}>{label}</span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function renderMarkdown(source: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls = level === 1 ? 'text-lg font-semibold' : level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={key} className={cls}>{renderInline(heading[2], key)}</Tag>);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(<li key={`${key}-${items.length}`}>{renderInline(lines[i].replace(/^\s*[-*]\s+/, ''), `${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ul key={key} className="list-disc ps-5 space-y-1">{items}</ul>);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(<li key={`${key}-${items.length}`}>{renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ''), `${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ol key={key} className="list-decimal ps-5 space-y-1">{items}</ol>);
      continue;
    }

    // Paragraph: consecutive plain lines, joined with line breaks
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key}>
        {paragraph.flatMap((p, j) => (j === 0 ? renderInline(p, `${key}-${j}`) : [<br key={`${key}-br${j}`} />, ...renderInline(p, `${key}-${j}`)]))}
      </p>
    );
  }
  return blocks;
}
