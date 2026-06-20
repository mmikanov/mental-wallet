# Requirements Document

## Introduction

App lock adds optional biometric or PIN authentication to protect sensitive mental health data from unauthorized access when the device is shared or the app is left open.

## Requirements

### Requirement 1: App Lock

**User Story:** As a user, I want to protect my app with biometric or PIN authentication, so that my sensitive mental health data stays private.

#### Acceptance Criteria

1. THE App SHALL provide an optional app lock using Face ID or a 4-to-6-digit PIN.
2. WHEN app lock is enabled and the app returns to the foreground, THE App SHALL require authentication before granting access.
3. IF a user enters an incorrect PIN 5 consecutive times, THEN THE App SHALL impose a 60-second lockout.
4. THE App SHALL store the PIN hashed with PBKDF2 in secure store.
