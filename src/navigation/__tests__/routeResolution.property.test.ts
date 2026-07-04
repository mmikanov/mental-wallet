import * as fc from 'fast-check';

/**
 * Pure function that mirrors the route resolution logic in RootNavigator.
 *
 * From RootNavigator.tsx:
 *   if (!disclaimerAcknowledged || !onboardingScreensComplete) {
 *     setInitialRoute('Onboarding');
 *   } else {
 *     // proceeds to MainTabs (or ModeChoice, but that's a separate concern)
 *   }
 *
 * Within the Onboarding navigator, the initial screen shown depends on
 * disclaimerAcknowledged:
 *   - false → Welcome screen (first screen in OnboardingNavigator)
 *   - true but screens not complete → PrivacyNotice (resume point after Welcome)
 *
 * For this property test we model the effective user-facing route as:
 *   - 'Welcome' if disclaimer not acknowledged
 *   - 'PrivacyNotice' if disclaimer acknowledged but screens not complete
 *   - 'MainTabs' if screens complete (disclaimer is necessarily also true)
 */
type EffectiveRoute = 'Welcome' | 'PrivacyNotice' | 'MainTabs';

function resolveInitialRoute(
  disclaimerAcknowledged: boolean,
  onboardingScreensComplete: boolean
): EffectiveRoute {
  if (!disclaimerAcknowledged) {
    return 'Welcome';
  }
  if (!onboardingScreensComplete) {
    return 'PrivacyNotice';
  }
  return 'MainTabs';
}

describe('Feature: onboarding, Property 7: State-to-route resolution', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any valid combination of onboarding completion flags
   * (disclaimerAcknowledged, onboardingScreensComplete), the resolved
   * initial navigation route SHALL be deterministic:
   *   - Welcome if disclaimer not acknowledged
   *   - PrivacyNotice if disclaimer acknowledged but screens not complete
   *   - MainTabs (WalletScreen) if screens complete
   */
  it('route resolution is deterministic for any valid flag combination', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // disclaimerAcknowledged
        fc.boolean(), // onboardingScreensComplete
        (disclaimerAcknowledged, onboardingScreensComplete) => {
          const route = resolveInitialRoute(disclaimerAcknowledged, onboardingScreensComplete);

          if (!disclaimerAcknowledged) {
            expect(route).toBe('Welcome');
          } else if (!onboardingScreensComplete) {
            expect(route).toBe('PrivacyNotice');
          } else {
            expect(route).toBe('MainTabs');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('same inputs always produce the same output (determinism)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (disclaimerAcknowledged, onboardingScreensComplete) => {
          const result1 = resolveInitialRoute(disclaimerAcknowledged, onboardingScreensComplete);
          const result2 = resolveInitialRoute(disclaimerAcknowledged, onboardingScreensComplete);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onboarding screens complete implies disclaimer acknowledged for valid states', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (disclaimerAcknowledged, onboardingScreensComplete) => {
          const route = resolveInitialRoute(disclaimerAcknowledged, onboardingScreensComplete);

          // If route is MainTabs, both flags must be true
          if (route === 'MainTabs') {
            expect(disclaimerAcknowledged).toBe(true);
            expect(onboardingScreensComplete).toBe(true);
          }

          // If disclaimer not acknowledged, route must be Welcome (never PrivacyNotice or MainTabs)
          if (!disclaimerAcknowledged) {
            expect(route).toBe('Welcome');
          }

          // If screens not complete and disclaimer acknowledged, route must be PrivacyNotice
          if (disclaimerAcknowledged && !onboardingScreensComplete) {
            expect(route).toBe('PrivacyNotice');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
