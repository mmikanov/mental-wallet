/**
 * Recommendation Service — Filters and ranks tools by emotion, context, and time
 * for the emotion-first session flow.
 *
 * Algorithm:
 * 1. Query emotion_tags for wallet cards matching the selected emotion
 * 2. Score wallet cards by context relevance, apply time filter, sort and limit to 3
 * 3. Filter CURATED_LIBRARY in-memory for library cards matching the emotion
 * 4. Exclude library cards already in the wallet, score, filter, sort, limit to 3
 * 5. If both sections empty → fallback to broadly-tagged tools from the library
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { getDatabase } from '@/data/database';
import { getCardIdsByEmotion, getContextTags, getTimeTags } from '@/services/emotionTagService';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

export interface ToolRecommendation {
  cardId: string;
  title: string;
  description: string;
  iconValue: string;
  source: 'wallet' | 'library';
  contextRelevanceScore: number;
}

export interface RecommendationResult {
  walletTools: ToolRecommendation[];
  libraryTools: ToolRecommendation[];
  isFallback: boolean;
}

const MAX_TOOLS_PER_SECTION = 3;

/**
 * Compute context relevance score: count of user-selected contexts
 * that appear in the tool's context tags.
 */
function computeContextScore(
  toolContextTags: ContextType[],
  selectedContexts: ContextType[]
): number {
  if (selectedContexts.length === 0) return 0;
  return selectedContexts.filter((ctx) => toolContextTags.includes(ctx)).length;
}

/**
 * Check if a tool passes the time filter.
 * If no time is selected, all tools pass.
 * If time is selected, the tool must have that time in its time tags.
 */
function passesTimeFilter(toolTimeTags: TimeType[], selectedTime: TimeType | null): boolean {
  if (selectedTime === null) return true;
  return toolTimeTags.includes(selectedTime);
}

/**
 * Sort recommendations by contextRelevanceScore DESC, then title ASC.
 */
function sortRecommendations(tools: ToolRecommendation[]): ToolRecommendation[] {
  return tools.sort((a, b) => {
    if (b.contextRelevanceScore !== a.contextRelevanceScore) {
      return b.contextRelevanceScore - a.contextRelevanceScore;
    }
    return a.title.localeCompare(b.title);
  });
}

/**
 * Get card details (title, description, iconValue) from the database for a wallet card.
 */
async function getWalletCardDetails(
  cardId: string
): Promise<{ title: string; description: string; iconValue: string } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    title: string;
    description: string;
    icon_value: string;
  }>(`SELECT title, description, icon_value FROM cards WHERE id = ?`, [cardId]);

  if (!row) return null;
  return {
    title: row.title,
    description: row.description,
    iconValue: row.icon_value,
  };
}

/**
 * Get wallet tool recommendations filtered by emotion, context, and time.
 */
async function getWalletRecommendations(
  emotion: EmotionType,
  contexts: ContextType[],
  time: TimeType | null,
  walletCardIds: string[]
): Promise<ToolRecommendation[]> {
  // 1. Get all card IDs that have this emotion tag
  const emotionMatchingIds = await getCardIdsByEmotion(emotion);

  // 2. Filter to cards that are in the user's wallet
  const walletMatches = emotionMatchingIds.filter((id) => walletCardIds.includes(id));

  // 3. For each matching wallet card, get context/time tags and card details
  const candidates: ToolRecommendation[] = [];

  for (const cardId of walletMatches) {
    const [cardTimeTags, cardContextTags, cardDetails] = await Promise.all([
      getTimeTags(cardId),
      getContextTags(cardId),
      getWalletCardDetails(cardId),
    ]);

    // Skip if card details not found
    if (!cardDetails) continue;

    // Apply time filter
    if (!passesTimeFilter(cardTimeTags, time)) continue;

    // Compute context relevance score
    const contextScore = computeContextScore(cardContextTags, contexts);

    candidates.push({
      cardId,
      title: cardDetails.title,
      description: cardDetails.description,
      iconValue: cardDetails.iconValue,
      source: 'wallet',
      contextRelevanceScore: contextScore,
    });
  }

  // 4. Sort and limit to 3
  return sortRecommendations(candidates).slice(0, MAX_TOOLS_PER_SECTION);
}

/**
 * Get library tool recommendations filtered by emotion, context, and time.
 * Excludes library cards that are already in the user's wallet.
 */
function getLibraryRecommendations(
  emotion: EmotionType,
  contexts: ContextType[],
  time: TimeType | null,
  walletCardIds: string[],
  walletSourceLibraryIds: string[] = [],
  walletCardTitles: string[] = []
): ToolRecommendation[] {
  const candidates: ToolRecommendation[] = [];

  for (const card of CURATED_LIBRARY) {
    // Filter by emotion match
    if (!card.emotionTags || !card.emotionTags.includes(emotion)) continue;

    // Exclude cards already in the wallet (match by source library ID, fallback to title)
    if (walletSourceLibraryIds.includes(card.id)) continue;
    if (walletCardTitles.includes(card.title)) continue;

    // Apply time filter
    const cardTimeTags = card.timeTags ?? [];
    if (!passesTimeFilter(cardTimeTags, time)) continue;

    // Compute context relevance score
    const cardContextTags = card.contextTags ?? [];
    const contextScore = computeContextScore(cardContextTags, contexts);

    candidates.push({
      cardId: card.id,
      title: card.title,
      description: card.description,
      iconValue: card.iconValue,
      source: 'library',
      contextRelevanceScore: contextScore,
    });
  }

  // Sort and limit to 3
  return sortRecommendations(candidates).slice(0, MAX_TOOLS_PER_SECTION);
}

/**
 * Get fallback recommendations when no tools match the selected emotion.
 * Returns up to 3 tools ordered by total emotion tag count (descending),
 * preferring tools NOT already in the user's wallet.
 */
function getFallbackRecommendations(walletCardIds: string[]): ToolRecommendation[] {
  // Get library cards with emotion tags, sorted by breadth (most tags first)
  const cardsWithTags = CURATED_LIBRARY.filter(
    (card) => card.emotionTags && card.emotionTags.length > 0
  );

  // Sort by: prefer non-wallet cards first, then by emotion tag count DESC, then title ASC
  const sorted = [...cardsWithTags].sort((a, b) => {
    const aInWallet = walletCardIds.includes(a.id) ? 1 : 0;
    const bInWallet = walletCardIds.includes(b.id) ? 1 : 0;

    // Prefer non-wallet cards
    if (aInWallet !== bInWallet) return aInWallet - bInWallet;

    // Then by emotion tag count DESC
    const aTagCount = a.emotionTags?.length ?? 0;
    const bTagCount = b.emotionTags?.length ?? 0;
    if (bTagCount !== aTagCount) return bTagCount - aTagCount;

    // Then title ASC
    return a.title.localeCompare(b.title);
  });

  return sorted.slice(0, MAX_TOOLS_PER_SECTION).map((card) => ({
    cardId: card.id,
    title: card.title,
    description: card.description,
    iconValue: card.iconValue,
    source: 'library' as const,
    contextRelevanceScore: 0,
  }));
}

/**
 * Get tool recommendations based on the user's selected emotion, context, time,
 * and current wallet contents.
 *
 * Returns wallet tools and library tools in separate sections, each limited to 3,
 * sorted by context relevance then title. Falls back to broadly-tagged tools
 * when no matches are found.
 */
export async function getRecommendations(
  emotion: EmotionType,
  contexts: ContextType[],
  time: TimeType | null,
  walletCardIds: string[],
  walletSourceLibraryIds: string[] = [],
  walletCardTitles: string[] = []
): Promise<RecommendationResult> {
  // Get wallet recommendations (async — queries DB)
  const walletTools = await getWalletRecommendations(emotion, contexts, time, walletCardIds);

  // Get library recommendations (sync — in-memory filtering)
  const libraryTools = getLibraryRecommendations(emotion, contexts, time, walletCardIds, walletSourceLibraryIds, walletCardTitles);

  // Check if both sections are empty → use fallback
  if (walletTools.length === 0 && libraryTools.length === 0) {
    const fallbackTools = getFallbackRecommendations(walletCardIds);
    return {
      walletTools: [],
      libraryTools: fallbackTools,
      isFallback: true,
    };
  }

  return {
    walletTools,
    libraryTools,
    isFallback: false,
  };
}
