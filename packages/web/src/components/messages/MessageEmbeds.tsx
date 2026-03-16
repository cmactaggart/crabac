import { MessageLinkEmbed, extractMessageLinks } from './MessageLinkEmbed.js';
import { SpaceLinkEmbed, extractSpaceLinks } from '../spaces/SpaceLinkEmbed.js';
import { CalendarEventCard, extractCalendarEvent } from '../calendar/CalendarEventCard.js';
import { UrlLinkEmbed } from './UrlLinkEmbed.js';
import { Markdown } from '../common/Markdown.js';
import type { LinkEmbed } from '@crabac/shared';

interface MessageEmbedsProps {
  content: string;
  spaceId?: string;
  embeds?: LinkEmbed[];
}

export function MessageEmbeds({ content, spaceId, embeds }: MessageEmbedsProps) {
  const calEvent = extractCalendarEvent(content);
  if (calEvent) {
    return (
      <>
        {calEvent.remainingContent && <Markdown content={calEvent.remainingContent} />}
        {(spaceId || calEvent.embed.spaceId) && (
          <CalendarEventCard embed={calEvent.embed} spaceId={spaceId || calEvent.embed.spaceId} />
        )}
      </>
    );
  }

  const linkedMessageIds = extractMessageLinks(content);
  const linkedSpaceRefs = spaceId ? extractSpaceLinks(content) : [];

  return (
    <>
      <Markdown content={content} />
      {linkedMessageIds.map((mid) => (
        <MessageLinkEmbed key={mid} messageId={mid} />
      ))}
      {linkedSpaceRefs.map((ref) => (
        <SpaceLinkEmbed
          key={ref.key}
          spaceId={ref.type === 'id' ? ref.value : undefined}
          spaceSlug={ref.type === 'slug' ? ref.value : undefined}
        />
      ))}
      {embeds && embeds.map((embed) => (
        <UrlLinkEmbed key={embed.id} embed={embed} />
      ))}
    </>
  );
}
