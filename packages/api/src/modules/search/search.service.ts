import { getTypesenseClient } from '../../lib/typesense.js';

const SPACE_MESSAGES_COLLECTION = 'space_messages';
const DIRECT_MESSAGES_COLLECTION = 'direct_messages';
const SOCIAL_POSTS_COLLECTION = 'social_posts';

// ─── Collection Setup ───

export async function ensureCollections(): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  const spaceSchema = {
    name: SPACE_MESSAGES_COLLECTION,
    fields: [
      { name: 'content', type: 'string' as const },
      { name: 'channel_id', type: 'string' as const, facet: true },
      { name: 'channel_name', type: 'string' as const, facet: true },
      { name: 'space_id', type: 'string' as const, facet: true },
      { name: 'author_id', type: 'string' as const, facet: true },
      { name: 'author_username', type: 'string' as const, facet: true },
      { name: 'created_at', type: 'int64' as const, sort: true },
    ],
  };

  const dmSchema = {
    name: DIRECT_MESSAGES_COLLECTION,
    fields: [
      { name: 'content', type: 'string' as const },
      { name: 'conversation_id', type: 'string' as const, facet: true },
      { name: 'author_id', type: 'string' as const, facet: true },
      { name: 'author_username', type: 'string' as const, facet: true },
      { name: 'created_at', type: 'int64' as const, sort: true },
    ],
  };

  const postsSchema = {
    name: SOCIAL_POSTS_COLLECTION,
    fields: [
      { name: 'body', type: 'string' as const },
      { name: 'user_id', type: 'string' as const, facet: true },
      { name: 'author_username', type: 'string' as const, facet: true },
      { name: 'visibility', type: 'string' as const, facet: true },
      { name: 'hashtags', type: 'string[]' as const, facet: true },
      { name: 'created_at', type: 'int64' as const, sort: true },
    ],
  };

  for (const schema of [spaceSchema, dmSchema, postsSchema]) {
    try {
      await client.collections(schema.name).retrieve();
    } catch {
      try {
        await client.collections().create(schema);
        console.log(`Typesense collection '${schema.name}' created`);
      } catch (err) {
        console.error(`Failed to create Typesense collection '${schema.name}':`, err);
      }
    }
  }
}

// ─── Snowflake → timestamp helper ───

const EPOCH = 1735689600000n;

function snowflakeToTimestamp(id: string): number {
  try {
    return Number((BigInt(id) >> 22n) + EPOCH);
  } catch {
    return Date.now();
  }
}

// ─── Space Messages ───

export async function indexSpaceMessage(doc: {
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  spaceId: string;
  authorId: string;
  authorUsername: string;
}): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SPACE_MESSAGES_COLLECTION).documents().upsert({
      id: doc.id,
      content: doc.content,
      channel_id: doc.channelId,
      channel_name: doc.channelName,
      space_id: doc.spaceId,
      author_id: doc.authorId,
      author_username: doc.authorUsername,
      created_at: snowflakeToTimestamp(doc.id),
    });
  } catch (err) {
    console.error('[Search] Failed to index space message:', err);
  }
}

export async function updateSpaceMessage(id: string, content: string): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SPACE_MESSAGES_COLLECTION).documents(id).update({ content });
  } catch (err) {
    console.error('[Search] Failed to update space message:', err);
  }
}

export async function removeSpaceMessage(id: string): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SPACE_MESSAGES_COLLECTION).documents(id).delete();
  } catch (err) {
    console.error('[Search] Failed to remove space message:', err);
  }
}

export async function searchSpaceMessages(
  spaceId: string,
  query: string,
  options: {
    channelId?: string;
    fromUsername?: string;
    inChannel?: string;
    limit?: number;
    before?: string;
  } = {},
): Promise<{ id: string; content: string; channelId: string; channelName: string; authorId: string; authorUsername: string }[]> {
  const client = getTypesenseClient();
  if (!client) return [];

  const filterParts: string[] = [`space_id:=${spaceId}`];

  if (options.channelId) filterParts.push(`channel_id:=${options.channelId}`);
  if (options.inChannel) filterParts.push(`channel_name:=${options.inChannel}`);
  if (options.fromUsername) filterParts.push(`author_username:=${options.fromUsername}`);
  if (options.before) {
    const ts = snowflakeToTimestamp(options.before);
    filterParts.push(`created_at:<${ts}`);
  }

  const results = await client.collections(SPACE_MESSAGES_COLLECTION).documents().search({
    q: query || '*',
    query_by: 'content',
    filter_by: filterParts.join(' && '),
    sort_by: 'created_at:desc',
    per_page: options.limit || 25,
  });

  return (results.hits || []).map((hit: any) => ({
    id: hit.document.id,
    content: hit.document.content,
    channelId: hit.document.channel_id,
    channelName: hit.document.channel_name,
    authorId: hit.document.author_id,
    authorUsername: hit.document.author_username,
  }));
}

// ─── Direct Messages ───

export async function indexDirectMessage(doc: {
  id: string;
  content: string;
  conversationId: string;
  authorId: string;
  authorUsername: string;
}): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(DIRECT_MESSAGES_COLLECTION).documents().upsert({
      id: doc.id,
      content: doc.content,
      conversation_id: doc.conversationId,
      author_id: doc.authorId,
      author_username: doc.authorUsername,
      created_at: snowflakeToTimestamp(doc.id),
    });
  } catch (err) {
    console.error('[Search] Failed to index direct message:', err);
  }
}

export async function updateDirectMessage(id: string, content: string): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(DIRECT_MESSAGES_COLLECTION).documents(id).update({ content });
  } catch (err) {
    console.error('[Search] Failed to update direct message:', err);
  }
}

export async function removeDirectMessage(id: string): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(DIRECT_MESSAGES_COLLECTION).documents(id).delete();
  } catch (err) {
    console.error('[Search] Failed to remove direct message:', err);
  }
}

export async function searchDirectMessages(
  conversationIds: string[],
  query: string,
  options: {
    conversationId?: string;
    limit?: number;
    before?: string;
  } = {},
): Promise<{ id: string; content: string; conversationId: string; authorId: string; authorUsername: string }[]> {
  const client = getTypesenseClient();
  if (!client || conversationIds.length === 0) return [];

  const filterParts: string[] = [];

  if (options.conversationId) {
    filterParts.push(`conversation_id:=${options.conversationId}`);
  } else {
    filterParts.push(`conversation_id:[${conversationIds.join(',')}]`);
  }

  if (options.before) {
    const ts = snowflakeToTimestamp(options.before);
    filterParts.push(`created_at:<${ts}`);
  }

  const results = await client.collections(DIRECT_MESSAGES_COLLECTION).documents().search({
    q: query || '*',
    query_by: 'content',
    filter_by: filterParts.join(' && '),
    sort_by: 'created_at:desc',
    per_page: options.limit || 25,
  });

  return (results.hits || []).map((hit: any) => ({
    id: hit.document.id,
    content: hit.document.content,
    conversationId: hit.document.conversation_id,
    authorId: hit.document.author_id,
    authorUsername: hit.document.author_username,
  }));
}

// ─── Social Posts ───

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export async function indexSocialPost(doc: {
  id: string;
  body: string;
  userId: string;
  authorUsername: string;
  visibility: string;
  hashtags: string[];
}): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SOCIAL_POSTS_COLLECTION).documents().upsert({
      id: doc.id,
      body: doc.body,
      user_id: doc.userId,
      author_username: doc.authorUsername,
      visibility: doc.visibility,
      hashtags: doc.hashtags,
      created_at: snowflakeToTimestamp(doc.id),
    });
  } catch (err) {
    console.error('[Search] Failed to index social post:', err);
  }
}

export async function updateSocialPost(id: string, body: string, visibility: string, hashtags: string[]): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SOCIAL_POSTS_COLLECTION).documents(id).update({ body, visibility, hashtags });
  } catch (err) {
    console.error('[Search] Failed to update social post:', err);
  }
}

export async function removeSocialPost(id: string): Promise<void> {
  const client = getTypesenseClient();
  if (!client) return;

  try {
    await client.collections(SOCIAL_POSTS_COLLECTION).documents(id).delete();
  } catch (err) {
    console.error('[Search] Failed to remove social post:', err);
  }
}

export async function searchSocialPosts(
  query: string,
  options: {
    hashtag?: string;
    limit?: number;
    before?: string;
    visibilityLevels?: string[];
  } = {},
): Promise<{ id: string; body: string; userId: string; authorUsername: string; visibility: string }[]> {
  const client = getTypesenseClient();
  if (!client) return [];

  const filterParts: string[] = [];

  // Filter by allowed visibility levels
  const levels = options.visibilityLevels || ['public'];
  filterParts.push(`visibility:[${levels.join(',')}]`);

  if (options.hashtag) {
    filterParts.push(`hashtags:=${options.hashtag.toLowerCase()}`);
  }
  if (options.before) {
    const ts = snowflakeToTimestamp(options.before);
    filterParts.push(`created_at:<${ts}`);
  }

  const results = await client.collections(SOCIAL_POSTS_COLLECTION).documents().search({
    q: query || '*',
    query_by: 'body',
    filter_by: filterParts.join(' && '),
    sort_by: 'created_at:desc',
    per_page: options.limit || 25,
  });

  return (results.hits || []).map((hit: any) => ({
    id: hit.document.id,
    body: hit.document.body,
    userId: hit.document.user_id,
    authorUsername: hit.document.author_username,
    visibility: hit.document.visibility,
  }));
}
