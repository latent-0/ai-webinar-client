/**
 * Media permission helpers (LLP-76 / T-70)
 *
 * Pure logic for turning camera/microphone permission states into a friendly,
 * non-blocking notice. The session stays fully usable when permission is
 * denied — this just tells the user what happened.
 */

export type PermState = PermissionState | undefined // 'granted' | 'denied' | 'prompt' | undefined

/**
 * Returns a short notice when camera and/or mic are blocked, or null when
 * everything is fine (or the permission state is unknown/unsupported).
 */
export function mediaPermissionNotice(cam: PermState, mic: PermState): string | null {
  const camBlocked = cam === 'denied'
  const micBlocked = mic === 'denied'
  if (camBlocked && micBlocked) {
    return 'Camera and microphone are blocked. You can still watch, follow along, and use chat.'
  }
  if (camBlocked) {
    return 'Camera is blocked. You can still speak, watch, and use chat.'
  }
  if (micBlocked) {
    return 'Microphone is blocked. You can still watch, follow along, and use chat.'
  }
  return null
}
