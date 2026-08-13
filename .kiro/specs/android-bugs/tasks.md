# Tasks

## Task 1: Fix tooltip highlight alignment

- [x] Move containerRef from SafeAreaView to regular View wrapper
- [x] Use measure() with pageX/pageY for relative coordinate computation
- [x] Verify on Android emulator
- _Status: Complete_

## Task 2: Fix tooltip arrow diamond shape

- [x] Replace rotated-square arrow with clipping wrapper approach
- [x] Remove old arrowUp/arrowDown styles
- [x] Verify triangle renders correctly on Android
- _Status: Complete_

## Task 3: Fix expanded card scroll

- [x] Import ScrollView from react-native-gesture-handler as GHScrollView
- [x] Use GHScrollView on Android when expanded, regular ScrollView otherwise
- [x] Fix Rules of Hooks violation (hooks after early return)
- [x] Apply same pattern to SessionLauncherContent for emotion session card
- [x] Verify scrolling works on Android without breaking iOS swipe-to-dismiss
- _Status: Complete_

## Task 4: Fix library card preview backdrop

- [x] Add androidSheet style with solid white background
- [x] Wrap sheet content in androidSheet view on Android
- [x] Verify preview displays cleanly on Android
- _Status: Complete_

## All tasks complete.
