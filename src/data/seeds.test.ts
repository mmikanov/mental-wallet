import { SEED_CATEGORIES, SEED_CRISIS_RESOURCES } from './seeds';

describe('Seed Data', () => {
  describe('SEED_CATEGORIES', () => {
    it('should contain exactly 6 categories', () => {
      expect(SEED_CATEGORIES).toHaveLength(6);
    });

    it('should have the correct category names in display order', () => {
      const names = SEED_CATEGORIES.map((c) => c.name);
      expect(names).toEqual([
        'Grounding & Calming',
        'Cognitive Reframing',
        'Body & Sensory',
        'Daily Check-In & Journaling',
        'Self-Compassion & Reminders',
        'Lightweight Connection',
      ]);
    });

    it('should have sequential display order starting at 1', () => {
      const orders = SEED_CATEGORIES.map((c) => c.displayOrder);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should have unique ids', () => {
      const ids = SEED_CATEGORIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have valid hex color codes', () => {
      for (const category of SEED_CATEGORIES) {
        expect(category.colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('SEED_CRISIS_RESOURCES', () => {
    it('should contain at least 2 crisis resources', () => {
      expect(SEED_CRISIS_RESOURCES.length).toBeGreaterThanOrEqual(2);
    });

    it('should include the 988 Suicide & Crisis Lifeline', () => {
      const lifeline = SEED_CRISIS_RESOURCES.find(
        (r) => r.id === 'us-988-lifeline'
      );
      expect(lifeline).toBeDefined();
      expect(lifeline!.phone).toBe('988');
      expect(lifeline!.countryCode).toBe('US');
      expect(lifeline!.isDefault).toBe(true);
    });

    it('should include the IASP international directory', () => {
      const iasp = SEED_CRISIS_RESOURCES.find(
        (r) => r.id === 'iasp-directory'
      );
      expect(iasp).toBeDefined();
      expect(iasp!.countryCode).toBe('INTL');
      expect(iasp!.url).toContain('iasp.info');
      expect(iasp!.isDefault).toBe(true);
    });

    it('should have unique ids', () => {
      const ids = SEED_CRISIS_RESOURCES.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have sequential display order', () => {
      for (let i = 0; i < SEED_CRISIS_RESOURCES.length; i++) {
        expect(SEED_CRISIS_RESOURCES[i].displayOrder).toBe(i + 1);
      }
    });
  });
});
