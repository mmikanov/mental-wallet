import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ANONYMOUS_USER_ID_KEY = 'anonymous_user_id';

/**
 * UUID v4 format: 8-4-4-4-12 hex characters with version 4 variant bits.
 * Pattern: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4.
 */
function isValidUuidV4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * Generates a UUID v4 using expo-crypto. Validates the output format.
 * Returns the UUID string or null if generation produced an invalid format.
 */
function generateUuid(): string | null {
  try {
    const uuid = Crypto.randomUUID();
    if (isValidUuidV4(uuid)) {
      return uuid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a valid UUID v4 with one retry on invalid format.
 * Returns the UUID string or null if both attempts produce invalid output.
 */
function generateUuidWithRetry(): string | null {
  const first = generateUuid();
  if (first) return first;

  // Retry once
  const second = generateUuid();
  return second;
}

/**
 * Resolves the Anonymous_User_ID for analytics.
 *
 * - Retrieves existing ID from expo-secure-store key `anonymous_user_id`
 * - If no valid ID exists, generates a new UUID v4 via expo-crypto and stores it
 * - On SecureStore read/write failure: generates new UUID, attempts one persist, uses generated ID regardless
 * - On invalid UUID format from generation: retries once; if still invalid, throws to block analytics dispatch
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */
export async function resolveAnonymousUserId(): Promise<string> {
  // Try to read existing ID from SecureStore
  let existingId: string | null = null;
  try {
    existingId = await SecureStore.getItemAsync(ANONYMOUS_USER_ID_KEY);
  } catch {
    // SecureStore read failed — fall through to generate new ID
    existingId = null;
  }

  // If we have a valid existing ID, use it
  if (existingId && isValidUuidV4(existingId)) {
    return existingId;
  }

  // Generate a new UUID (with one retry on invalid format)
  const newId = generateUuidWithRetry();

  if (!newId) {
    // Both generation attempts produced invalid UUIDs — block analytics dispatch
    throw new Error(
      'Failed to generate a valid UUID v4 for anonymous user ID after retry. Analytics dispatch is blocked.'
    );
  }

  // Attempt to persist the new ID (one attempt, non-blocking on failure)
  try {
    await SecureStore.setItemAsync(ANONYMOUS_USER_ID_KEY, newId);
  } catch {
    // Persist failed — use the generated ID regardless (requirement 1.4)
  }

  return newId;
}

/**
 * Resets the Anonymous_User_ID by deleting the existing one and generating a fresh ID.
 *
 * - Deletes existing ID from SecureStore (proceeds even if deletion fails)
 * - Generates a new UUID v4
 * - Persists the new ID (one attempt)
 * - Returns the new ID regardless of persist success
 *
 * Requirements: 1.5, 6.3, 6.8
 */
export async function resetAnonymousUserId(): Promise<string> {
  // Delete existing ID (proceed even if this fails — requirement 6.8)
  try {
    await SecureStore.deleteItemAsync(ANONYMOUS_USER_ID_KEY);
  } catch {
    // Deletion failed — proceed with overwrite
  }

  // Generate a new UUID (with one retry on invalid format)
  const newId = generateUuidWithRetry();

  if (!newId) {
    throw new Error(
      'Failed to generate a valid UUID v4 for anonymous user ID after retry. Analytics dispatch is blocked.'
    );
  }

  // Attempt to persist the new ID (one attempt)
  try {
    await SecureStore.setItemAsync(ANONYMOUS_USER_ID_KEY, newId);
  } catch {
    // Persist failed — use generated ID regardless
  }

  return newId;
}
