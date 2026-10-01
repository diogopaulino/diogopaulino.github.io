// Optional browser API key. Keep empty for the keyless satellite experience.
// A deployment key is public: restrict HTTP referrers to diogopaulino.com.br/*
// and API access to Map Tiles API. Set billing quotas in Google Cloud.
// Visitors may instead supply a session-only key in the app's settings.
export const config = Object.freeze({ googleMapsApiKey: '', cesiumVersion: '1.121' });
