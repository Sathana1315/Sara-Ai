import { CandidateItem, RecommendationExplanation, UserProfile } from '@sara/shared';

/**
 * Generates an empirical, data-backed explanation for why an item was recommended.
 * Avoids generic/fake templates; references actual interest topics and match scores.
 */
export function generateExplanation(
  candidate: CandidateItem,
  profile: UserProfile,
  score: number
): RecommendationExplanation {
  const matchingSignals: string[] = [];

  for (const kw of candidate.keywords) {
    const signal = profile.interests[kw.toLowerCase()];
    if (signal) {
      const confidencePct = Math.round(signal.confidence * 100);
      matchingSignals.push(`Observed interest in "${signal.topic}" (${confidencePct}% confidence)`);
    }
  }

  const matchPercentage = Math.round(score * 100);

  let primaryReason = '';
  if (matchingSignals.length > 0) {
    primaryReason = `${matchPercentage}% match based on your recent searches and views related to ${candidate.keywords.slice(0, 2).join(', ')}.`;
  } else {
    primaryReason = `${matchPercentage}% match recommended based on category relevance in ${candidate.category}.`;
  }

  return {
    matchPercentage,
    primaryReason,
    supportingSignals: matchingSignals.slice(0, 3)
  };
}
