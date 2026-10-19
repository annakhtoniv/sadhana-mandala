/**
 * Phase 22: pictures made on the phone (nothing is uploaded): the badge to
 * share on WhatsApp and the certificate for completing the practice. Drawn on
 * a canvas, so Arabic and Hindi names and texts use the phone's own fonts.
 */
import type { BadgeLook } from './badges';

const FONT = '"Geist", "Noto Sans Arabic", "Noto Sans Devanagari", system-ui, sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

/** Wraps text into lines that fit a width. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function emblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: BadgeLook) {
  const g = ctx.createConicGradient ? ctx.createConicGradient(-Math.PI / 3, x, y) : null;
  if (g) {
    g.addColorStop(0, look.from);
    g.addColorStop(0.5, look.to);
    g.addColorStop(1, look.from);
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g || look.to;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(r * 0.9)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(look.emblem, x, y + r * 0.04);
}

const toBlob = (c: HTMLCanvasElement, type = 'image/png') =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), type, 0.92));

/** A square picture of a badge with a short line, for WhatsApp. */
export async function badgeImage(opts: { look: BadgeLook; title: string; subtitle: string; footer: string; rtl: boolean }): Promise<Blob> {
  const { c, ctx } = canvas(1080, 1080);
  const bg = ctx.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, '#f7fdf9');
  bg.addColorStop(1, '#e8f7ef');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);
  emblem(ctx, 540, 380, 190, opts.look);
  ctx.direction = opts.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#18181b';
  ctx.font = `700 64px ${FONT}`;
  lines(ctx, opts.title, 900).forEach((l, i) => ctx.fillText(l, 540, 680 + i * 78));
  ctx.fillStyle = '#3f3f46';
  ctx.font = `400 42px ${FONT}`;
  lines(ctx, opts.subtitle, 900).forEach((l, i) => ctx.fillText(l, 540, 840 + i * 54));
  ctx.fillStyle = '#047857';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(opts.footer, 540, 1010);
  return toBlob(c);
}

/** Shares a picture (WhatsApp appears in the phone's share sheet); else saves it and opens WhatsApp with the text. */
export async function sharePicture(blob: Blob, fileName: string, text: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'; // the person closed the share sheet
    }
  }
  download(blob, fileName);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'saved';
}

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface CertificateText {
  heading: string;
  certifies: string;
  name: string;
  completed: string;
  details: string;
  teacher: string;
  org: string;
}

/** The certificate as an A4 landscape PDF (the page is a picture, so every script prints correctly). */
export async function certificatePdf(text: CertificateText, look: BadgeLook, rtl: boolean): Promise<Blob> {
  const W = 2339;
  const H = 1654; // A4 at 200 dpi
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, W, H);
  // Double border in the badge colours
  ctx.strokeStyle = look.to;
  ctx.lineWidth = 18;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.strokeStyle = look.from;
  ctx.lineWidth = 6;
  ctx.strokeRect(110, 110, W - 220, H - 220);
  emblem(ctx, W / 2, 330, 120, look);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#18181b';
  ctx.font = `700 96px ${FONT}`;
  ctx.fillText(text.heading, W / 2, 590);
  ctx.fillStyle = '#52525b';
  ctx.font = `400 46px ${FONT}`;
  ctx.fillText(text.certifies, W / 2, 690);
  ctx.fillStyle = '#047857';
  ctx.font = `700 110px ${FONT}`;
  ctx.fillText(text.name, W / 2, 850);
  ctx.fillStyle = '#27272a';
  ctx.font = `400 52px ${FONT}`;
  lines(ctx, text.completed, 1700).forEach((l, i) => ctx.fillText(l, W / 2, 980 + i * 70));
  ctx.fillStyle = '#52525b';
  ctx.font = `400 44px ${FONT}`;
  ctx.fillText(text.details, W / 2, 1180);
  ctx.fillText(text.teacher, W / 2, 1250);
  ctx.fillStyle = '#18181b';
  ctx.font = `600 48px ${FONT}`;
  ctx.fillText(text.org, W / 2, 1420);

  const jpeg = c.toDataURL('image/jpeg', 0.9);
  const { jsPDF } = await import('jspdf'); // loaded only when someone downloads a certificate
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(jpeg, 'JPEG', 0, 0, 297, 210);
  return pdf.output('blob');
}
