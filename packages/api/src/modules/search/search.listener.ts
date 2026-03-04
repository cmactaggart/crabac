import { eventBus } from '../../lib/event-bus.js';
import { getTypesenseClient } from '../../lib/typesense.js';
import { db } from '../../database/connection.js';
import * as searchService from './search.service.js';

export function registerSearchListener() {
  // ── Space Messages ─────────────────────────────────────────────

  eventBus.on('message.created', async ({ message, channelId }) => {
    if (!getTypesenseClient()) return;
    try {
      const ch = await db('channels').where('id', channelId).select('name', 'space_id').first();
      if (!ch) return;

      const author = message.author?.username
        || (await db('users').where('id', message.authorId || message.author_id).select('username').first())?.username;

      await searchService.indexSpaceMessage({
        id: String(message.id),
        content: message.content || '',
        channelId: String(channelId),
        channelName: ch.name,
        spaceId: String(ch.space_id),
        authorId: String(message.authorId || message.author_id),
        authorUsername: author || '',
      });
    } catch (err) {
      console.error('[SearchListener] message.created error:', err);
    }
  });

  eventBus.on('message.updated', async ({ message }) => {
    if (!getTypesenseClient()) return;
    try {
      await searchService.updateSpaceMessage(String(message.id), message.content || '');
    } catch (err) {
      console.error('[SearchListener] message.updated error:', err);
    }
  });

  eventBus.on('message.deleted', async ({ messageId }) => {
    if (!getTypesenseClient()) return;
    try {
      await searchService.removeSpaceMessage(String(messageId));
    } catch (err) {
      console.error('[SearchListener] message.deleted error:', err);
    }
  });

  // ── Direct Messages ────────────────────────────────────────────

  eventBus.on('dm.created', async ({ message, conversationId }) => {
    if (!getTypesenseClient()) return;
    try {
      const authorUsername = message.author?.username
        || (await db('users').where('id', message.authorId || message.author_id).select('username').first())?.username;

      await searchService.indexDirectMessage({
        id: String(message.id),
        content: message.content || '',
        conversationId: String(conversationId),
        authorId: String(message.authorId || message.author_id),
        authorUsername: authorUsername || '',
      });
    } catch (err) {
      console.error('[SearchListener] dm.created error:', err);
    }
  });

  eventBus.on('dm.updated', async ({ message }) => {
    if (!getTypesenseClient()) return;
    try {
      await searchService.updateDirectMessage(String(message.id), message.content || '');
    } catch (err) {
      console.error('[SearchListener] dm.updated error:', err);
    }
  });

  eventBus.on('dm.deleted', async ({ messageId }) => {
    if (!getTypesenseClient()) return;
    try {
      await searchService.removeDirectMessage(String(messageId));
    } catch (err) {
      console.error('[SearchListener] dm.deleted error:', err);
    }
  });
}
