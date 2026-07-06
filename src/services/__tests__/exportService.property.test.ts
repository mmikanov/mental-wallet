// Feature: curator-admin-panel, Property 10: Export serialization includes all required CuratedCardDefinition fields
import * as fc from 'fast-check';
import { serializeToCuratedDefinition } from '@/services/exportService';
import type { Card, Control, ControlType, ControlConfig } from '@/types/index';

// Mock expo-clipboard (not used directly in serialize, but imported by the module)
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  cacheDirectory: '/mock-cache/',
  writeAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));

// Mock the database module (used by emotionTagService)
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock emotionTagService tag queries since serializeToCuratedDefinition fetches tags
jest.mock('@/services/emotionTagService', () => ({
  getTagsForCard: jest.fn().mockResolvedValue([]),
  getContextTags: jest.fn().mockResolvedValue([]),
  getTimeTags: jest.fn().mockResolvedValue([]),
}));

import { getTagsForCard, getContextTags, getTimeTags } from '@/services/emotionTagService';

const mockGetTagsForCard = getTagsForCard as jest.MockedFunction<typeof getTagsForCard>;
const mockGetContextTags = getContextTags as jest.MockedFunction<typeof getContextTags>;
const mockGetTimeTags = getTimeTags as jest.MockedFunction<typeof getTimeTags>;

// --- Generators ---

const controlTypes: ControlType[] = [
  'static_text',
  'text_input',
  'text_area',
  'mood_slider',
  'choice_buttons',
  'checkbox',
  'counter',
  'datetime_stamp',
  'image_attachment',
  'link_button',
  'display_media',
  'upload_media',
];


function configForType(type: ControlType): fc.Arbitrary<ControlConfig> {
  switch (type) {
    case 'static_text':
      return fc.record({
        body: fc.string({ minLength: 1, maxLength: 100 }),
        fontSize: fc.constantFrom('small' as const, 'medium' as const, 'large' as const),
      });
    case 'text_input':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        placeholder: fc.string({ minLength: 0, maxLength: 50 }),
        maxLength: fc.integer({ min: 1, max: 200 }),
      });
    case 'text_area':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        placeholder: fc.string({ minLength: 0, maxLength: 50 }),
      });
    case 'mood_slider':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        minLabel: fc.string({ minLength: 0, maxLength: 20 }),
        maxLabel: fc.string({ minLength: 0, maxLength: 20 }),
      });
    case 'choice_buttons':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        options: fc.array(
          fc.record({ text: fc.string({ minLength: 1, maxLength: 20 }) }),
          { minLength: 1, maxLength: 8 }
        ),
      });
    case 'checkbox':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
      });
    case 'counter':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        min: fc.integer({ min: 0, max: 10 }),
        max: fc.integer({ min: 11, max: 100 }),
      });
    case 'datetime_stamp':
      return fc.record({
        displayMode: fc.constantFrom('visible' as const, 'hidden' as const),
      });
    case 'image_attachment':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
      });
    case 'link_button':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        targetUrl: fc.webUrl(),
      });
    case 'display_media':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        mediaSourceType: fc.constantFrom('local_file' as const, 'direct_url' as const, 'platform_url' as const),
        mediaFileType: fc.constantFrom('image' as const, 'video' as const, 'audio' as const),
        source: fc.string({ minLength: 1, maxLength: 100 }),
        platform: fc.constantFrom(null, 'youtube' as const, 'vimeo' as const),
        cachedPath: fc.constant(null),
      });
    case 'upload_media':
      return fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        acceptedTypes: fc.array(
          fc.constantFrom('image' as const, 'video' as const, 'audio' as const),
          { minLength: 1, maxLength: 3 }
        ),
      });
    default:
      return fc.record({ label: fc.string({ minLength: 1, maxLength: 50 }) }) as fc.Arbitrary<ControlConfig>;
  }
}

const controlArb: fc.Arbitrary<Control> = fc
  .constantFrom(...controlTypes)
  .chain((type) =>
    fc.tuple(
      fc.uuid(),
      fc.uuid(),
      fc.nat({ max: 9 }),
      configForType(type),
      fc.boolean()
    ).map(([id, cardId, position, config, isRequired]) => ({
      id,
      cardId,
      type,
      position,
      config,
      isRequired,
    }))
  );

const cardArb: fc.Arbitrary<Card> = fc.record({
  id: fc.stringMatching(/^admin-lib-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  description: fc.string({ minLength: 1, maxLength: 300 }),
  iconType: fc.constantFrom('emoji' as const, 'third_party' as const),
  iconValue: fc.string({ minLength: 1, maxLength: 50 }),
  backgroundType: fc.constantFrom('color' as const, 'image' as const),
  backgroundValue: fc.string({ minLength: 1, maxLength: 50 }),
  categoryId: fc.string({ minLength: 1, maxLength: 30 }),
  originBadge: fc.constant('library' as const),
  stackPosition: fc.constant(-1),
  totalUses: fc.constant(0),
  currentStreak: fc.constant(0),
  lastUsedAt: fc.constant(null),
  isArchived: fc.constant(false),
  archivedAt: fc.constant(null),
  previousStackPosition: fc.constant(null),
  allowBackgroundCustomization: fc.boolean(),
  sourceLibraryId: fc.constant(null),
  controls: fc.array(controlArb, { minLength: 1, maxLength: 10 }),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00Z'),
});

// --- Property Test ---

describe('exportService - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty tag arrays
    mockGetTagsForCard.mockResolvedValue([]);
    mockGetContextTags.mockResolvedValue([]);
    mockGetTimeTags.mockResolvedValue([]);
  });

  describe('Feature: curator-admin-panel, Property 10: Export serialization includes all required CuratedCardDefinition fields', () => {
    /**
     * **Validates: Requirements 6.2, 6.5**
     *
     * For any admin library card or static override with varied field values and
     * control types, serializeToCuratedDefinition() SHALL produce a string that,
     * when evaluated, yields an object containing all required CuratedCardDefinition
     * fields: id, title, description, iconType, iconValue, backgroundType,
     * backgroundValue, categoryId, allowBackgroundCustomization, and a controls
     * array where each element has type, position, config, and isRequired.
     */
    it('serialized output contains all required CuratedCardDefinition fields for any card', async () => {
      await fc.assert(
        fc.asyncProperty(cardArb, async (card) => {
          const result = await serializeToCuratedDefinition(card);

          // Parse the serialized string by wrapping it in a Function to evaluate
          // Using Function constructor to safely evaluate the TS literal
          const parsed = new Function(`return (${result})`)();

          // Verify all top-level required fields exist
          expect(parsed).toHaveProperty('id', card.id);
          expect(parsed).toHaveProperty('title', card.title);
          expect(parsed).toHaveProperty('description', card.description);
          expect(parsed).toHaveProperty('iconType', card.iconType);
          expect(parsed).toHaveProperty('iconValue', card.iconValue);
          expect(parsed).toHaveProperty('backgroundType', card.backgroundType);
          expect(parsed).toHaveProperty('backgroundValue', card.backgroundValue);
          expect(parsed).toHaveProperty('categoryId', card.categoryId);
          expect(parsed).toHaveProperty('allowBackgroundCustomization', card.allowBackgroundCustomization);

          // Verify controls array exists and has the same length
          expect(parsed.controls).toBeInstanceOf(Array);
          expect(parsed.controls).toHaveLength(card.controls.length);

          // Verify each control has all required fields
          for (let i = 0; i < parsed.controls.length; i++) {
            const ctrl = parsed.controls[i];
            expect(ctrl).toHaveProperty('type', card.controls[i].type);
            expect(ctrl).toHaveProperty('position', card.controls[i].position);
            expect(ctrl).toHaveProperty('config');
            expect(typeof ctrl.config).toBe('object');
            expect(ctrl).toHaveProperty('isRequired', card.controls[i].isRequired);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
