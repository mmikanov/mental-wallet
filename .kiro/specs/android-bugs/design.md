# Android Bugs — Design

## Overview

Android-specific visual and behavioral bugs found during emulator testing. All fixes are targeted and platform-conditional where needed to avoid iOS regressions.

## Fix Implementations

### Bug 1: Tooltip Highlight Misaligned (Fixed)

**Root Cause**: `measureInWindow` on `SafeAreaView` returns coordinates including the Android status bar, but the `TooltipOverlay` is positioned relative to the SafeAreaView content area.

**Fix**: Moved `containerRef` from `SafeAreaView` to a regular `View` wrapper inside it. Both target and container are measured with `measure()` using `pageX/pageY`, then the relative offset is computed.

**Files**: `src/screens/WalletScreen.tsx`, `src/components/onboarding/TooltipOverlay.tsx`

### Bug 2: Tooltip Arrow Diamond Shape (Fixed)

**Root Cause**: On Android, `overflow: hidden` doesn't clip children with `transform: rotate(45deg)`. The rotated square (meant to look like a triangle) renders as a full diamond.

**Fix**: Replaced the single rotated-square approach with a clipping wrapper: a container `View` with fixed height and `overflow: hidden` contains the rotated inner square, producing a triangle on both platforms.

**Files**: `src/components/onboarding/TooltipOverlay.tsx`

### Bug 3: Cannot Scroll Expanded Card Content (Fixed)

**Root Cause**: On Android, `ScrollView` from `react-native` doesn't coordinate with `GestureDetector` from `react-native-gesture-handler`. The gesture handler intercepts all vertical touches before the ScrollView can consume them.

**Fix**: Use `ScrollView` from `react-native-gesture-handler` (imported as `GHScrollView`) on Android when the card is expanded. iOS keeps the regular RN ScrollView which cooperates naturally with the pan gesture. Applied to both `FocusedCardView` (regular cards) and `SessionLauncherContent` (emotion session card).

**Files**: `src/components/wallet/FocusedCardView.tsx`, `src/components/session/SessionLauncherContent.tsx`

### Bug 4: Library Card Preview Lacks Backdrop (Fixed)

**Root Cause**: On Android, the `Modal` with `transparent={true}` shows the library list behind the preview sheet. The sheet content doesn't have its own solid background container.

**Fix**: Wrapped the sheet content in an `androidSheet` view with solid white background, rounded top corners, and top margin on Android.

**Files**: `src/components/wallet/CardPreviewSheet.tsx`

## Key Patterns Established

- **ScrollView inside GestureDetector on Android**: Always use `ScrollView` from `react-native-gesture-handler`
- **Platform-conditional ScrollView**: `const ScrollView = Platform.OS === 'android' ? GHScrollView : RNScrollView`
- **Measurement relative to container**: Use `measure()` with pageX/pageY on both target and container, compute difference
- **Arrow/tooltip clipping**: Use wrapper view with overflow:hidden instead of relying on parent clip
