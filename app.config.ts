// Overlays a base URL onto the static app.json config so the same export can be
// served from a domain root (local dev, Netlify) or a GitHub Pages subpath.
// CI sets EXPO_BASE_URL=/motionsensor; locally it defaults to "" (root).
import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: {
    ...(config.experiments ?? {}),
    baseUrl: process.env.EXPO_BASE_URL ?? '',
  },
});
