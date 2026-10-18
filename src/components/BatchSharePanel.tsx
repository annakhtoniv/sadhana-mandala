import React, { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { batchJoinUrl } from '../lib/joinLink';
import { batchShareMessage, whatsappUrl } from '../lib/crmUtils';
import { Check, Copy, Download, MessageCircle, Share2 } from 'lucide-react';

interface BatchSharePanelProps {
  batchName: string;
  courseName: string;
  joinCode: string;
  appName: string;
}

const POSTER_QR = 640;

/**
 * Batch QR and link sharing. A new student scans the QR (or opens the link),
 * signs in with Google and is enrolled in the batch automatically.
 */
export const BatchSharePanel: React.FC<BatchSharePanelProps> = ({ batchName, courseName, joinCode, appName }) => {
  const url = batchJoinUrl(joinCode, window.location.origin);
  const message = batchShareMessage({ batchName, courseName, joinUrl: url, appName });
  const [copied, setCopied] = useState(false);
  const posterQrRef = useRef<HTMLCanvasElement>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: batchName, text: message });
    } catch {
      // the person closed the share sheet
    }
  };

  // A printable poster: batch name, programme, QR code and join code
  const downloadPoster = () => {
    const qr = posterQrRef.current;
    if (!qr) return;
    const width = 800;
    const height = 1060;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText(courseName || appName, width / 2, 70);
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText(batchName.length > 30 ? `${batchName.slice(0, 29)}…` : batchName, width / 2, 130);
    ctx.drawImage(qr, (width - POSTER_QR) / 2, 170, POSTER_QR, POSTER_QR);
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.fillText('Scan with your phone camera and sign in with Google', width / 2, 880);
    ctx.fillText('to join this batch.', width / 2, 920);
    ctx.font = '700 40px ui-monospace, monospace';
    ctx.fillText(`Join code: ${joinCode}`, width / 2, 995);
    const link = document.createElement('a');
    link.download = `${joinCode}-join-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const buttonClass =
    'py-2.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100 flex items-center justify-center gap-1.5 cursor-pointer';

  return (
    <div className="space-y-3">
      <div className="p-4 bg-stone-50 rounded-2xl flex flex-col items-center gap-2">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          <QRCodeSVG value={url} size={180} level="M" aria-label={`QR code to join ${batchName}`} />
        </div>
        <div className="font-mono text-lg font-bold tracking-widest text-stone-900">{joinCode}</div>
        <p className="text-xs text-stone-500 text-center max-w-xs">
          Students scan this with their phone camera, sign in with Google, and are added to this batch automatically.
          No app or link needed beforehand.
        </p>
        <div className="text-xs text-stone-500 break-all text-center">{url}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {canShare ? (
          <button type="button" onClick={share} className={buttonClass}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        ) : (
          <a href={whatsappUrl(null, message)} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
        <button type="button" onClick={copyLink} className={buttonClass}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        {canShare && (
          <a href={whatsappUrl(null, message)} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
        <button type="button" onClick={downloadPoster} className={`${buttonClass} ${canShare ? '' : 'col-span-2'}`}>
          <Download className="w-3.5 h-3.5" /> Download QR poster
        </button>
      </div>

      {/* Large QR for the printable poster (not shown) */}
      <QRCodeCanvas ref={posterQrRef} value={url} size={POSTER_QR} level="M" marginSize={2} style={{ display: 'none' }} />
    </div>
  );
};
