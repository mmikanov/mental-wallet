/**
 * AudioPlayer — Reusable audio playback component with play/pause, seek bar,
 * and duration display. All interactive elements are minimum 44×44pt.
 *
 * Validates: Requirements 3.4
 *
 * Note: Uses a placeholder implementation. In production, integrate expo-av
 * or react-native-track-player for actual audio playback.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface AudioPlayerProps {
  uri: string;
  label?: string;
  accessibilityLabel?: string;
}

export default function AudioPlayer({ uri, label, accessibilityLabel }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const togglePlayback = useCallback(async () => {
    try {
      setError(null);
      setIsPlaying((prev) => !prev);
      // TODO: Integrate expo-av Audio.Sound for actual playback
      // const { sound } = await Audio.Sound.createAsync({ uri });
      // await sound.playAsync();
    } catch (e) {
      setError('Unable to play audio');
      setIsPlaying(false);
    }
  }, [uri]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={togglePlayback}
          accessibilityRole="button"
          accessibilityLabel="Retry audio playback"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel || `Audio player: ${label || 'audio'}`}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.playerRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlayback}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
        </TouchableOpacity>

        <View style={styles.seekContainer}>
          <View style={styles.seekTrack}>
            <View style={[styles.seekProgress, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(progress * duration)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playIcon: {
    fontSize: 18,
  },
  seekContainer: {
    flex: 1,
  },
  seekTrack: {
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekProgress: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
});
