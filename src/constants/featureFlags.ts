/**
 * Temporary feature flags.
 *
 * See docs/NOTIFICATIONS.md and docs/FACE_MESH.md for how to re-enable.
 */

/** Paid Apple Developer account needed for App Store push capability. */
export const NOTIFICATIONS_ENABLED = false;

/**
 * Face mesh uses Vision Camera + ML Kit, which require a custom native
 * development build (not Expo Go). Disabled so day-to-day work can run in
 * Expo Go with plain expo-camera.
 */
export const FACE_MESH_ENABLED = false;
