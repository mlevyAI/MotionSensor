// Same-device alert interface (v1). The web build plays an in-app Web Audio
// tone + vibration while foregrounded. A future native build can implement the
// same contract with expo-audio / expo-haptics / expo-notifications.

export interface Alerter {
  /** Prime audio under a user gesture (browsers block autoplay otherwise). */
  prime(): Promise<void>;
  /** Fire the alert (sound + vibration). Safe to call repeatedly; self-debounced by caller. */
  fire(): void;
  /** Stop any ongoing alert sound. */
  stop(): void;
}
