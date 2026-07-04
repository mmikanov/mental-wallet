# Requirements Document

## Introduction

The MVP shipped with a curated library of 10–12 cards and category filter tabs. This spec adds text search, sort options, and expands the library to the full planned set of 18–21 cards.

## Requirements

### Requirement 1: Library Search and Sort

**User Story:** As a user, I want to search and sort the library, so that I can quickly find relevant tools.

#### Acceptance Criteria

1. THE App SHALL provide a search function matching library cards by partial text against card title, description, or category name, beginning after 1 character is entered.
2. THE App SHALL provide a sort option to order library cards from newest to oldest.
3. IF a search query or category filter returns no matching cards, THEN THE App SHALL display an empty state message.
4. THE App SHALL expand the curated library from 10–12 cards to the full set of 18–21 cards across all categories.
