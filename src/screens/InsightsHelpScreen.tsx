/**
 * InsightsHelpScreen — "How this works" help page for Usage-Outcome Insights.
 *
 * Explains the methodology behind insights in plain, conversational language.
 * Sections cover: what we measure, how patterns are found, how we know if a
 * tool helps in the moment, why some sessions count more, what the tiers mean,
 * tools to reconsider, patterns not proof, and data privacy.
 *
 * - Scrollable with consistent typography (section headers 17px bold, body 15px, line height 22)
 * - Proper heading hierarchy for screen readers (accessibilityRole="header")
 * - Back navigation to Insights screen
 *
 * Validates: Requirements 11.5, 11.6, 11.7, 11.8
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { logEvent } from '@/services/analyticsEventLogger';

type Props = NativeStackScreenProps<RootStackParamList, 'InsightsHelp'>;

interface HelpSection {
  title: string;
  paragraphs: string[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'What we measure',
    paragraphs: [
      'We track two things: how long you spend with each tool (active time in the foreground) and your daily check-in score \u2014 the number you log each day about how you\u2019re feeling.',
    ],
  },
  {
    title: 'How patterns are found',
    paragraphs: [
      'We compare your check-in scores on days you used a tool (and the day before) to days you didn\u2019t. If your scores tend to be higher on days associated with a tool, that\u2019s noted as a positive pattern.',
      'We don\u2019t track you on specific days \u2014 we look at the overall averages across your chosen time period.',
    ],
  },
  {
    title: 'How we know if a tool helps in the moment',
    paragraphs: [
      'After using a tool, you can optionally log how you feel (calmer, clearer, etc.). We combine these responses with the daily check-in pattern to classify each tool\u2019s overall effectiveness.',
    ],
  },
  {
    title: 'Why some sessions count more',
    paragraphs: [
      'Sessions where you spent more time count a bit more toward your pattern \u2014 the idea is that deeper engagement matters more than a quick tap. The weighting is gentle: at most double, at least half.',
    ],
  },
  {
    title: 'What the tiers mean',
    paragraphs: [
      'As you gather more data, insights get more confident:',
      '\u2022 Nascent (3+ check-ins, 3+ tool uses): Activity summaries and engagement trends.',
      '\u2022 Preliminary (7+ check-ins, 5+ uses across 2+ tools): Early patterns with caveats.',
      '\u2022 Confident (14+ check-ins, 10+ uses across 2+ tools): Full insights and Best Tools ranking.',
    ],
  },
  {
    title: 'Tools to reconsider',
    paragraphs: [
      'If a tool consistently doesn\u2019t seem to help \u2014 both in your daily patterns and in how you feel right after \u2014 we\u2019ll gently note it. This is never a judgment. You can keep any tool that matters to you.',
    ],
  },
  {
    title: 'Important: patterns, not proof',
    paragraphs: [
      'Everything here reflects associations, not proof of cause and effect. Many things affect how you feel on a given day. These patterns are one piece of the puzzle.',
    ],
  },
  {
    title: 'Your data stays on your device',
    paragraphs: [
      'All analysis happens locally on your phone. No data is sent to any server.',
    ],
  },
];

export default function InsightsHelpScreen({ navigation }: Props) {
  useEffect(() => {
    void logEvent('insights_viewed', { screen: 'insights_help' });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How this works</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {HELP_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              {section.title}
            </Text>
            {section.paragraphs.map((paragraph, pIndex) => (
              <Text key={pIndex} style={styles.sectionBody}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 6,
  },
});
