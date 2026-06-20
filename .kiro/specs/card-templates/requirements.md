# Requirements Document

## Introduction

Card templates provide pre-configured starting points for common mental health tool types. Instead of building every card from scratch, users can select a template that pre-populates the creation flow with appropriate Controls and placeholder values. Templates accelerate card creation while preserving full customization flexibility.

## Glossary

- **Template**: A pre-configured combination of Controls and Card_Shell placeholder values for common use cases.

## Requirements

### Requirement 1: Template Selection

**User Story:** As a user, I want pre-configured card templates for common use cases, so that I can quickly add tools without building them from scratch.

#### Acceptance Criteria

1. THE App SHALL provide pre-configured templates including: Affirmation/Reminder (static text block with primary action), Simple Instruction (numbered static text blocks with optional timer and reflection input), Mini-Form/Check-In (mood slider and text inputs), Journaling/Reflection (prompt text with multi-line text area), and Mood Tracker (mood slider with optional context text inputs).
2. WHEN a user selects "Create new tool", THE App SHALL offer the option to start from a template or start from scratch before entering the creation flow.
3. WHEN a user selects a template, THE App SHALL pre-populate the card with the template's default Controls and placeholder Card_Shell values which the user can then modify.
4. WHILE editing a template-based card, THE App SHALL allow the user to modify, reorder, add, or remove any pre-populated Controls and Card_Shell fields, subject to the same validation rules as manually composed cards.
5. THE App SHALL treat template-based cards identically to manually composed cards for data storage, analytics, and display purposes.
