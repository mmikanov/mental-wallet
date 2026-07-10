/**
 * Unit tests for RationaleSheet component.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { RationaleSheet } from '../RationaleSheet';
import type { RationaleMetadata } from '@/types/rationale';

jest.spyOn(Linking, 'openURL');

const baseRationale: RationaleMetadata = {
  approach: 'CBT',
  inANutshell: 'Helps reframe negative thought patterns into more balanced perspectives.',
  howItWorks: 'CBT techniques engage the prefrontal cortex to evaluate thoughts logically rather than emotionally.',
  evidenceLevel: 'strong',
  researchSummary: [
    'CBT is one of the most widely studied psychotherapy approaches.',
    'Research suggests CBT may help reduce symptoms of anxiety and depression.',
  ],
};

const rationaleWithLinks: RationaleMetadata = {
  ...baseRationale,
  learnMoreLinks: [
    { title: 'CBT overview — NHS', url: 'https://nhs.uk/mental-health/treatments/cbt' },
    { title: 'Research on CBT — PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/12345' },
  ],
};

const rationaleNotStudied: RationaleMetadata = {
  ...baseRationale,
  evidenceLevel: 'not_specifically_studied',
  learnMoreLinks: [
    { title: 'General wellbeing — WHO', url: 'https://who.int/wellbeing' },
  ],
};

describe('RationaleSheet', () => {
  const mockOnDismiss = jest.fn();
  const mockOnCrisisResourcesPress = jest.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
    mockOnCrisisResourcesPress.mockClear();
    (Linking.openURL as jest.Mock).mockClear();
  });

  describe('content sections and order', () => {
    it('renders all sections in correct order', async () => {
      const rationaleAllSections: RationaleMetadata = {
        ...baseRationale,
        evidenceLevel: 'not_specifically_studied',
        learnMoreLinks: [
          { title: 'Test link', url: 'https://nhs.uk/test' },
        ],
      };
      const { toJSON } = await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleAllSections}
          cardTitle="Ordered Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      const json = JSON.stringify(toJSON());
      const cardTitleIndex = json.indexOf('Ordered Card');
      const nutshellIndex = json.indexOf('In a nutshell');
      const howItWorksIndex = json.indexOf('How it works');
      const badgeIndex = json.indexOf('Based on general principles');
      const researchIndex = json.indexOf('What we know from research');
      const disclaimerIndex = json.indexOf('It has not been specifically studied');
      const learnMoreIndex = json.indexOf('Further reading');

      // All sections should be present
      expect(cardTitleIndex).toBeGreaterThan(-1);
      expect(nutshellIndex).toBeGreaterThan(-1);
      expect(howItWorksIndex).toBeGreaterThan(-1);
      expect(badgeIndex).toBeGreaterThan(-1);
      expect(researchIndex).toBeGreaterThan(-1);
      expect(disclaimerIndex).toBeGreaterThan(-1);
      expect(learnMoreIndex).toBeGreaterThan(-1);

      // Verify order: title < nutshell < how it works < badge < research < disclaimer < learn more
      expect(cardTitleIndex).toBeLessThan(nutshellIndex);
      expect(nutshellIndex).toBeLessThan(howItWorksIndex);
      expect(howItWorksIndex).toBeLessThan(badgeIndex);
      expect(badgeIndex).toBeLessThan(researchIndex);
      expect(researchIndex).toBeLessThan(disclaimerIndex);
      expect(disclaimerIndex).toBeLessThan(learnMoreIndex);
    });

    it('renders card title as header', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="5-4-3-2-1 Grounding"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('5-4-3-2-1 Grounding')).toBeTruthy();
    });

    it('renders "In a nutshell" section', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('In a nutshell')).toBeTruthy();
      expect(screen.getByText(baseRationale.inANutshell)).toBeTruthy();
    });

    it('renders "How it works" section', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('How it works')).toBeTruthy();
      expect(screen.getByText(baseRationale.howItWorks)).toBeTruthy();
    });

    it('renders research summary bullets', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('What we know from research')).toBeTruthy();
      expect(screen.getByText(baseRationale.researchSummary[0])).toBeTruthy();
      expect(screen.getByText(baseRationale.researchSummary[1])).toBeTruthy();
    });
  });

  describe('evidence level badge', () => {
    it('displays "Well-researched approach" for strong evidence', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'strong' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('Well-researched approach')).toBeTruthy();
    });

    it('displays "Growing research support" for moderate evidence', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'moderate' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('Growing research support')).toBeTruthy();
    });

    it('displays "Early research" for emerging evidence', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'emerging' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('Early research')).toBeTruthy();
    });

    it('displays "Based on general principles" for not_specifically_studied', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'not_specifically_studied' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('Based on general principles')).toBeTruthy();
    });
  });

  describe('disclaimer', () => {
    it('shows disclaimer when evidence level is not_specifically_studied', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleNotStudied}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(
        screen.getByText(
          'This tool draws on general wellbeing principles. It has not been specifically studied in this exact form.'
        )
      ).toBeTruthy();
    });

    it('does not show disclaimer for strong evidence level', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(
        screen.queryByText(
          'This tool draws on general wellbeing principles. It has not been specifically studied in this exact form.'
        )
      ).toBeNull();
    });

    it('does not show disclaimer for moderate evidence level', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'moderate' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(
        screen.queryByText(
          'This tool draws on general wellbeing principles. It has not been specifically studied in this exact form.'
        )
      ).toBeNull();
    });

    it('does not show disclaimer for emerging evidence level', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={{ ...baseRationale, evidenceLevel: 'emerging' }}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(
        screen.queryByText(
          'This tool draws on general wellbeing principles. It has not been specifically studied in this exact form.'
        )
      ).toBeNull();
    });
  });

  describe('learn more links', () => {
    it('renders learn more section when links exist', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleWithLinks}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText('Further reading')).toBeTruthy();
      expect(screen.getByText('CBT overview — NHS ↗')).toBeTruthy();
      expect(screen.getByText('Research on CBT — PubMed ↗')).toBeTruthy();
    });

    it('hides learn more section when links array is empty', async () => {
      const rationaleEmptyLinks: RationaleMetadata = {
        ...baseRationale,
        learnMoreLinks: [],
      };
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleEmptyLinks}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.queryByText('Further reading')).toBeNull();
    });

    it('hides learn more section when links are undefined', async () => {
      const rationaleNoLinks: RationaleMetadata = {
        ...baseRationale,
        learnMoreLinks: undefined,
      };
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleNoLinks}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.queryByText('Further reading')).toBeNull();
    });

    it('opens URL via Linking when link is tapped', async () => {
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleWithLinks}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      fireEvent.press(screen.getByText('CBT overview — NHS ↗'));
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          'https://nhs.uk/mental-health/treatments/cbt'
        );
      });
    });

    it('shows inline error when link fails to open', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('Cannot open URL'));
      await render(
        <RationaleSheet
          visible={true}
          rationale={rationaleWithLinks}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      fireEvent.press(screen.getByText('CBT overview — NHS ↗'));
      await waitFor(() => {
        expect(screen.getByText("This link couldn't be opened.")).toBeTruthy();
      });
    });
  });

  describe('dismissal', () => {
    it('calls onDismiss when close button is pressed', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Test Card"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      fireEvent.press(screen.getByLabelText('Close'));
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('crisis resources', () => {
    it('shows crisis resources callout when isDistressRelated is true', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Anxiety Relief"
          isDistressRelated={true}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.getByText(/crisis/i)).toBeTruthy();
    });

    it('hides crisis resources callout when isDistressRelated is false', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Gratitude Journal"
          isDistressRelated={false}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      expect(screen.queryByLabelText('Crisis support resources')).toBeNull();
    });

    it('calls onCrisisResourcesPress when crisis callout is tapped', async () => {
      await render(
        <RationaleSheet
          visible={true}
          rationale={baseRationale}
          cardTitle="Anxiety Relief"
          isDistressRelated={true}
          onDismiss={mockOnDismiss}
          onCrisisResourcesPress={mockOnCrisisResourcesPress}
        />
      );
      fireEvent.press(screen.getByLabelText('Crisis support resources'));
      expect(mockOnCrisisResourcesPress).toHaveBeenCalledTimes(1);
    });
  });
});
