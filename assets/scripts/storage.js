export function loadJsonState(storageKey, fallback) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (error) {
    return fallback;
  }
}

export function saveJsonState(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures in static mode.
  }
}

export function clearJsonState(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    // Ignore storage failures in static mode.
  }
}
