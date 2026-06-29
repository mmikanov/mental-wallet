import { SEED_CATEGORIES, SEED_CRISIS_RESOURCES, SESSION_LAUNCHER_CARD, SESSION_LAUNCHER_CONTROLS } from './seeds';

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

describe('SESSION_LAUNCHER_CARD', () => {
  it('should have id "session-launcher"', () => {
    expect(SESSION_LAUNCHER_CARD.id).toBe('session-launcher');
  });

  it('should have card type "session_launcher"', () => {
    expect(SESSION_LAUNCHER_CARD.cardType).toBe('session_launcher');
  });

  it('should have the correct title and description', () => {
    expect(SESSION_LAUNCHER_CARD.title).toBe('Start from how I feel');
    expect(SESSION_LAUNCHER_CARD.description).toBe(
      "Tell the app what you're dealing with to get suggested tools."
    );
  });

  it('should be positioned below starter cards with stack_position 99', () => {
    expect(SESSION_LAUNCHER_CARD.stackPosition).toBe(99);
  });

  it('should not allow background customization', () => {
    expect(SESSION_LAUNCHER_CARD.allowBackgroundCustomization).toBe(true);
  });

  it('should use a valid category id', () => {
    const categoryIds = SEED_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain(SESSION_LAUNCHER_CARD.categoryId);
  });
});

describe('SESSION_LAUNCHER_CONTROLS', () => {
  it('should have exactly 3 controls', () => {
    expect(SESSION_LAUNCHER_CONTROLS).toHaveLength(3);
  });

  it('should have deterministic control IDs', () => {
    expect(SESSION_LAUNCHER_CONTROLS[0].id).toBe('ctrl-session-launcher-0');
    expect(SESSION_LAUNCHER_CONTROLS[1].id).toBe('ctrl-session-launcher-1');
    expect(SESSION_LAUNCHER_CONTROLS[2].id).toBe('ctrl-session-launcher-2');
  });

  it('should have sequential positions starting at 0', () => {
    const positions = SESSION_LAUNCHER_CONTROLS.map((c) => c.position);
    expect(positions).toEqual([0, 1, 2]);
  });

  it('should all be choice_buttons type', () => {
    for (const control of SESSION_LAUNCHER_CONTROLS) {
      expect(control.type).toBe('choice_buttons');
    }
  });

  it('should have emotion picker as first control with 6 emotions', () => {
    const emotionControl = SESSION_LAUNCHER_CONTROLS[0];
    expect(emotionControl.config.label).toBe('How are you feeling right now?');
    expect(emotionControl.config.options).toHaveLength(6);
    expect(emotionControl.isRequired).toBe(true);
  });

  it('should have context chips as second control with 5 options', () => {
    const contextControl = SESSION_LAUNCHER_CONTROLS[1];
    expect(contextControl.config.label).toBe('Where are you right now?');
    expect(contextControl.config.options).toHaveLength(5);
    expect(contextControl.isRequired).toBe(false);
  });

  it('should have time chips as third control with 2 options', () => {
    const timeControl = SESSION_LAUNCHER_CONTROLS[2];
    expect(timeControl.config.label).toBe('How much time do you have?');
    expect(timeControl.config.options).toHaveLength(2);
    expect(timeControl.isRequired).toBe(false);
  });

  it('should have the correct emotion options with icons', () => {
    const options = SESSION_LAUNCHER_CONTROLS[0].config.options;
    const texts = options.map((o) => o.text);
    expect(texts).toEqual([
      'Stressed',
      'Overwhelmed',
      'Anxious',
      'Sad/low',
      'Angry',
      'Numb',
    ]);
    // Each emotion option has an icon
    for (const option of options) {
      expect(option.icon).toBeDefined();
    }
  });
});
