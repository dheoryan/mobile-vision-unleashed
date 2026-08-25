export const LOCATION_RADII = [5, 15, 50] as const;
export type LocationRadiusKm = (typeof LOCATION_RADII)[number];

export type BrowserLocation = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
};

export function requestBrowserLocation(): Promise<BrowserLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Location is not supported on this device."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. You can continue with city-only discovery."
            : "We couldn't get your location. Try again somewhere with a clearer signal.";
        reject(new Error(message));
      },
      // This runs only after an explicit tap, so favour a fresh GPS fix over a
      // cached network estimate that may belong to another part of the metro.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
