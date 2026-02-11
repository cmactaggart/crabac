import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export function useQRCode(text: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) { setDataUrl(null); return; }
    QRCode.toDataURL(text, {
      width: 512,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [text]);

  return dataUrl;
}
