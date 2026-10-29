/** Ordinary builds retain the production consent hold and Android-only display. */
export const nativeAdsBuild = {
  permissionReady: (verified: boolean, _origin: string): boolean => verified,
  iosEnabled: (_origin: string): boolean => false,
};
