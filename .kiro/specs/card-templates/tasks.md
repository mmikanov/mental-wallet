# Tasks

## Task 1: Define template data

- [ ] Create `src/data/templates.ts` with 5 template definitions (Affirmation/Reminder, Simple Instruction, Mini-Form/Check-In, Journaling/Reflection, Mood Tracker)
- Each template provides: id, name, description, defaultShell (placeholder title/description/icon/background), and defaultControls array
- Export a `getTemplates()` function returning all available templates
- _Requirements: 1.1_

## Task 2: Implement template picker UI

- [ ] Create `src/components/creator/TemplatePickerSheet.tsx` showing template options plus "Start from scratch"
- Each template displayed with name and short description
- Selecting a template passes pre-populated data to CardCreatorScreen
- "Start from scratch" navigates to Step 1 with empty state (existing behavior)
- _Requirements: 1.2, 1.3_

## Task 3: Integrate template picker into creation flow

- [ ] Modify `CardCreatorScreen.tsx` to show TemplatePickerSheet when entering creation mode
- Accept template data as initial state for Step 1 (shell) and Step 2 (controls)
- Ensure all pre-populated fields are fully editable with existing validation rules
- Template-based cards save with origin badge "my_tool" identically to scratch-built cards
- _Requirements: 1.3, 1.4, 1.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] }
  ]
}
```
