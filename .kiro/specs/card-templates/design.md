# Design Document

## Overview

Templates are defined as static data objects in `src/data/templates.ts`. Each template specifies a default Card_Shell (title, description, icon, background) and an ordered list of Controls. The existing card creation flow is extended with a template selection step inserted before Step 1.

## Architecture

The template system integrates into the existing card creation flow without new services or database changes. Templates are pure data definitions consumed by the CardCreatorScreen.

## Components and Interfaces

### Template Data Structure

```typescript
interface CardTemplate {
  id: string;
  name: string;
  description: string;
  defaultShell: Partial<CardShell>;
  defaultControls: Omit<Control, 'id' | 'cardId'>[];
}
```

### Template Definitions

Located in `src/data/templates.ts`:

| Template | Default Controls |
|----------|----------|
| Affirmation/Reminder | Static text block (body: placeholder affirmation) |
| Simple Instruction | 3 numbered static text blocks + optional text area for reflection |
| Mini-Form/Check-In | Mood slider + 1–2 single-line text inputs |
| Journaling/Reflection | Static text (prompt) + multi-line text area |
| Mood Tracker | Mood slider + 2 optional context text inputs |

### UI Changes

- New `TemplatePickerSheet.tsx` component shown when user taps "Create new tool"
- Options: "Start from scratch" and one button per template
- Selecting a template navigates to Step 1 with pre-populated data
- No changes to the existing Step 1/2/3 flow — template data is simply initial state

## Data Models

No new database tables. Templates are compile-time constants. Template-based cards are stored identically to manually composed cards.

## Testing Strategy

- Unit test: each template produces valid Controls (within 1–10 range, valid types)
- Unit test: template selection pre-populates CardCreatorScreen state correctly
