import { BehaviorEvent, EventType } from '@sara/shared';

/**
 * Creates human-explainable learning history audit entries when user profile weights change.
 */
export function generateLearningExplanation(
  event: BehaviorEvent,
  topicsUpdated: string[],
  scoreDelta: number
): string {
  if (topicsUpdated.length === 0) {
    return `Observed ${event.eventType.toLowerCase()} on ${event.domain} with no new keyword adjustments.`;
  }

  const topicsList = topicsUpdated.slice(0, 4).join(', ');
  const moreCount = topicsUpdated.length > 4 ? ` (+${topicsUpdated.length - 4} more)` : '';

  switch (event.eventType) {
    case EventType.SEARCH:
      return `Strengthened interest in [${topicsList}${moreCount}] derived from explicit search query "${event.searchQuery || event.title}" on ${event.domain}.`;

    case EventType.VIDEO_VIEW:
    case EventType.MEDIA_COMPLETE:
      return `Strengthened interest in [${topicsList}${moreCount}] based on video view engagement on ${event.domain} ("${event.title}").`;

    case EventType.PRODUCT_VIEW:
      return `Strengthened interest in [${topicsList}${moreCount}] from e-commerce product observation on ${event.domain} ("${event.title}").`;

    case EventType.CONTENT_VIEW:
    case EventType.LONG_VIEW:
      return `Strengthened interest in [${topicsList}${moreCount}] based on long-form article engagement on ${event.domain}.`;

    case EventType.DWELL_TIME:
      return `Reinforced topic weights for [${topicsList}${moreCount}] due to extended dwell time (${Math.round((event.durationMs || 0) / 1000)}s) on ${event.domain}.`;

    case EventType.SCROLL_MILESTONE:
      return `Increased confidence in [${topicsList}${moreCount}] after deep reading (${Math.round((event.scrollDepth || 0) * 100)}% scroll) on ${event.domain}.`;

    case EventType.LIKE:
      return `Explicit positive feedback boosted interest in [${topicsList}${moreCount}].`;

    case EventType.DISLIKE:
    case EventType.SKIP:
      return `Explicit negative feedback reduced interest weight for [${topicsList}${moreCount}].`;

    default:
      return `Updated interest weights for [${topicsList}${moreCount}] based on ${event.eventType.toLowerCase()} signal on ${event.domain}.`;
  }
}
