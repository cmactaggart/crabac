import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { eventBus } from '../../lib/event-bus.js';
import { extractUrls, scrapeOg } from './og-scrape.service.js';

interface EmbedRow {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  ogType: string | null;
}

function formatEmbed(row: any): EmbedRow {
  return {
    id: String(row.id),
    url: row.url,
    title: row.title || null,
    description: row.description || null,
    imageUrl: row.image_url || null,
    faviconUrl: row.favicon_url || null,
    siteName: row.site_name || null,
    ogType: row.og_type || null,
  };
}

// ─── Channel Messages ───

export async function processMessageEmbeds(messageId: string, channelId: string, content: string) {
  const urls = extractUrls(content);
  if (urls.length === 0) return;

  const embeds: EmbedRow[] = [];

  for (const url of urls) {
    const og = await scrapeOg(url);
    if (!og) continue;

    const id = snowflake.generate();
    await db('message_embeds').insert({
      id,
      message_id: messageId,
      url: og.url,
      title: og.title,
      description: og.description,
      image_url: og.imageUrl,
      favicon_url: og.faviconUrl,
      site_name: og.siteName,
      og_type: og.ogType,
    });

    embeds.push({ id: String(id), ...og });
  }

  if (embeds.length > 0) {
    eventBus.emit('message.embeds_ready', { channelId, messageId, embeds });
  }
}

export async function reprocessMessageEmbeds(messageId: string, channelId: string, content: string) {
  await db('message_embeds').where('message_id', messageId).delete();
  await processMessageEmbeds(messageId, channelId, content);
}

export async function getEmbedsForMessages(messageIds: string[]): Promise<Map<string, EmbedRow[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('message_embeds').whereIn('message_id', messageIds).select('*');
  const result = new Map<string, EmbedRow[]>();
  for (const row of rows) {
    const key = String(row.message_id);
    const list = result.get(key) || [];
    list.push(formatEmbed(row));
    result.set(key, list);
  }
  return result;
}

// ─── DM Messages ───

export async function processDMEmbeds(messageId: string, conversationId: string, content: string) {
  const urls = extractUrls(content);
  if (urls.length === 0) return;

  const embeds: EmbedRow[] = [];

  for (const url of urls) {
    const og = await scrapeOg(url);
    if (!og) continue;

    const id = snowflake.generate();
    await db('dm_message_embeds').insert({
      id,
      dm_message_id: messageId,
      url: og.url,
      title: og.title,
      description: og.description,
      image_url: og.imageUrl,
      favicon_url: og.faviconUrl,
      site_name: og.siteName,
      og_type: og.ogType,
    });

    embeds.push({ id: String(id), ...og });
  }

  if (embeds.length > 0) {
    eventBus.emit('dm.embeds_ready', { conversationId, messageId, embeds });
  }
}

export async function reprocessDMEmbeds(messageId: string, conversationId: string, content: string) {
  await db('dm_message_embeds').where('dm_message_id', messageId).delete();
  await processDMEmbeds(messageId, conversationId, content);
}

export async function getDMEmbedsForMessages(messageIds: string[]): Promise<Map<string, EmbedRow[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('dm_message_embeds').whereIn('dm_message_id', messageIds).select('*');
  const result = new Map<string, EmbedRow[]>();
  for (const row of rows) {
    const key = String(row.dm_message_id);
    const list = result.get(key) || [];
    list.push(formatEmbed(row));
    result.set(key, list);
  }
  return result;
}
