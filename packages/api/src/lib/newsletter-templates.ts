interface NewsletterEmailData {
  subject: string;
  summary: string | null;
  headerImageUrl: string | null;
  blocks: any[];
  senderName: string;
  trackingToken: string | null;
  unsubscribeToken: string;
  appUrl: string;
}

/**
 * Render a newsletter into an HTML email.
 * Uses table-based layout for Outlook compatibility.
 */
export function renderNewsletterEmail(data: NewsletterEmailData): string {
  const { subject, summary, headerImageUrl, blocks, senderName, trackingToken, unsubscribeToken, appUrl } = data;

  const preferencesUrl = `${appUrl}/newsletter/preferences/${unsubscribeToken}`;
  const unsubscribeUrl = `${appUrl}/api/newsletter-public/unsubscribe/${unsubscribeToken}`;

  let bodyHtml = '';

  // Header image
  if (headerImageUrl) {
    const imgSrc = headerImageUrl.startsWith('/') ? `${appUrl}${headerImageUrl}` : headerImageUrl;
    bodyHtml += `
      <tr><td style="padding:0;">
        <img src="${escapeHtml(imgSrc)}" alt="" style="width:100%;max-width:600px;height:auto;display:block;border-radius:8px 8px 0 0;" />
      </td></tr>`;
  }

  // Title
  bodyHtml += `
    <tr><td style="padding:24px 24px 8px;">
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#1a1a2e;line-height:1.3;">${escapeHtml(subject)}</h1>
    </td></tr>`;

  // Summary
  if (summary) {
    bodyHtml += `
      <tr><td style="padding:0 24px 16px;">
        <p style="margin:0;font-size:16px;color:#555;line-height:1.5;">${escapeHtml(summary)}</p>
      </td></tr>`;
  }

  // Blocks
  for (const block of blocks) {
    bodyHtml += renderBlock(block, appUrl, trackingToken);
  }

  // Tracking pixel
  let trackingPixel = '';
  if (trackingToken) {
    trackingPixel = `<img src="${appUrl}/api/newsletter-track/open/${trackingToken}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <!-- Header -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:16px 24px;text-align:center;">
          <span style="font-size:14px;color:#888;">${escapeHtml(senderName)}</span>
        </td></tr>
      </table>
      <!-- Content -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        ${bodyHtml}
      </table>
      <!-- Footer -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:24px;text-align:center;font-size:12px;color:#999;line-height:1.6;">
          <a href="${escapeHtml(preferencesUrl)}" style="color:#5865f2;text-decoration:underline;">Manage preferences</a>
          &nbsp;&middot;&nbsp;
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
          <br />Powered by <a href="https://crab.ac" style="color:#5865f2;text-decoration:none;">crab.ac</a>
        </td></tr>
      </table>
      ${trackingPixel}
    </td></tr>
  </table>
</body>
</html>`;
}

function renderBlock(block: any, appUrl: string, trackingToken: string | null): string {
  switch (block.type) {
    case 'text':
      return `<tr><td style="padding:8px 24px;font-size:16px;color:#333;line-height:1.6;">
        ${simpleMarkdown(block.content)}
      </td></tr>`;

    case 'image': {
      const src = block.url?.startsWith('/') ? `${appUrl}${block.url}` : block.url;
      return `<tr><td style="padding:8px 24px;text-align:center;">
        <img src="${escapeHtml(src || '')}" alt="${escapeHtml(block.alt || '')}" style="max-width:100%;height:auto;border-radius:6px;" />
        ${block.caption ? `<p style="margin:8px 0 0;font-size:13px;color:#888;text-align:center;">${escapeHtml(block.caption)}</p>` : ''}
      </td></tr>`;
    }

    case 'image_gallery': {
      const images = block.images || [];
      let galleryHtml = '<tr><td style="padding:8px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>';
      images.forEach((img: any, i: number) => {
        const src = img.url?.startsWith('/') ? `${appUrl}${img.url}` : img.url;
        galleryHtml += `<td style="padding:4px;width:${Math.floor(100 / Math.min(images.length, 3))}%;vertical-align:top;">
          <img src="${escapeHtml(src || '')}" alt="${escapeHtml(img.alt || '')}" style="width:100%;height:auto;border-radius:4px;" />
        </td>`;
        if ((i + 1) % 3 === 0 && i < images.length - 1) galleryHtml += '</tr><tr>';
      });
      galleryHtml += '</tr></table></td></tr>';
      return galleryHtml;
    }

    case 'quote':
      return `<tr><td style="padding:8px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:4px;background:#5865f2;border-radius:2px;"></td>
            <td style="padding:12px 16px;font-size:16px;color:#555;font-style:italic;line-height:1.5;">
              ${escapeHtml(block.content || '')}
              ${block.attribution ? `<br /><span style="font-style:normal;font-size:13px;color:#888;">— ${escapeHtml(block.attribution)}</span>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>`;

    case 'divider':
      return `<tr><td style="padding:16px 24px;">
        <hr style="border:none;border-top:1px solid #eee;margin:0;" />
      </td></tr>`;

    case 'embed':
      return `<tr><td style="padding:8px 24px;">
        <a href="${escapeHtml(block.url || '#')}" style="color:#5865f2;font-size:15px;text-decoration:underline;">${escapeHtml(block.title || block.url || 'Link')}</a>
      </td></tr>`;

    case 'section_heading':
      return `<tr><td style="padding:16px 24px 8px;">
        <h2 style="margin:0;font-size:20px;font-weight:600;color:#1a1a2e;">${escapeHtml(block.content || '')}</h2>
      </td></tr>`;

    default:
      return '';
  }
}

/**
 * Very simple markdown-to-HTML for email (bold, italic, links, line breaks).
 */
function simpleMarkdown(text: string): string {
  if (!text) return '';
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#5865f2;">$1</a>');
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a digest email containing multiple newsletters.
 */
export function renderDigestEmail(data: {
  newsletters: Array<{ subject: string; summary: string | null; publishedAt: string; readUrl: string }>;
  frequency: 'daily' | 'weekly';
  unsubscribeToken: string;
  appUrl: string;
}): string {
  const { newsletters, frequency, unsubscribeToken, appUrl } = data;
  const preferencesUrl = `${appUrl}/newsletter/preferences/${unsubscribeToken}`;
  const title = frequency === 'daily' ? 'Your Daily Digest' : 'Your Weekly Digest';

  let itemsHtml = '';
  for (const nl of newsletters) {
    itemsHtml += `
      <tr><td style="padding:16px 24px;border-bottom:1px solid #f0f0f0;">
        <a href="${escapeHtml(nl.readUrl)}" style="font-size:18px;font-weight:600;color:#1a1a2e;text-decoration:none;line-height:1.4;">${escapeHtml(nl.subject)}</a>
        ${nl.summary ? `<p style="margin:6px 0 0;font-size:14px;color:#666;line-height:1.5;">${escapeHtml(nl.summary)}</p>` : ''}
        <p style="margin:8px 0 0;"><a href="${escapeHtml(nl.readUrl)}" style="font-size:13px;color:#5865f2;text-decoration:none;">Read more &rarr;</a></p>
      </td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:16px 24px;text-align:center;">
          <span style="font-size:14px;color:#888;">crab.ac</span>
        </td></tr>
      </table>
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#1a1a2e;">${title}</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#888;">${newsletters.length} newsletter${newsletters.length !== 1 ? 's' : ''} from your subscriptions</p>
        </td></tr>
        ${itemsHtml}
      </table>
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:24px;text-align:center;font-size:12px;color:#999;line-height:1.6;">
          <a href="${escapeHtml(preferencesUrl)}" style="color:#5865f2;text-decoration:underline;">Manage preferences</a>
          <br />Powered by <a href="https://crab.ac" style="color:#5865f2;text-decoration:none;">crab.ac</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
