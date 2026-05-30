import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type AppTheme = 'light' | 'dark' | 'system';
export type LayoutMode = 'list' | 'grid';

const KEYS = {
  THEME: 'settings_theme',
  LAYOUT: 'settings_layout',
  DEFAULT_LANG: 'settings_default_lang',
  OFFLINE_FALLBACK: 'settings_offline_fallback',
  GEMINI_API_KEY: 'secure_gemini_api_key',
};

/**
 * Get the current app theme preference. Defaults to 'dark'.
 */
export async function getThemePreference(): Promise<AppTheme> {
  try {
    const val = await AsyncStorage.getItem(KEYS.THEME);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch (e) {
    // Ignore error
  }
  return 'dark'; // Premium dark-mode first design
}

/**
 * Save the app theme preference.
 */
export async function setThemePreference(theme: AppTheme): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME, theme);
}

/**
 * Get the current layout mode preference ('list' or 'grid'). Defaults to 'list'.
 */
export async function getLayoutPreference(): Promise<LayoutMode> {
  try {
    const val = await AsyncStorage.getItem(KEYS.LAYOUT);
    if (val === 'list' || val === 'grid') {
      return val;
    }
  } catch (e) {
    // Ignore error
  }
  return 'list';
}

/**
 * Save the layout mode preference.
 */
export async function setLayoutPreference(layout: LayoutMode): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAYOUT, layout);
}

/**
 * Get default code language for snippet creation. Defaults to 'javascript'.
 */
export async function getDefaultLanguagePreference(): Promise<string> {
  try {
    const val = await AsyncStorage.getItem(KEYS.DEFAULT_LANG);
    if (val) return val;
  } catch (e) {
    // Ignore error
  }
  return 'javascript';
}

/**
 * Save default code language preference.
 */
export async function setDefaultLanguagePreference(lang: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.DEFAULT_LANG, lang.toLowerCase());
}

/**
 * Check if the user wants to force the offline local AI mock fallback. Defaults to false.
 */
export async function getForceOfflineFallbackPreference(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.OFFLINE_FALLBACK);
    return val === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Set the offline fallback preference.
 */
export async function setForceOfflineFallbackPreference(force: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.OFFLINE_FALLBACK, force ? 'true' : 'false');
}

/**
 * Securely retrieve the Gemini API Key.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  try {
    // SecureStore is only supported on native.
    // Check if SecureStore is available (to prevent crash on web environments)
    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) {
      // Fallback for web debugging
      return localStorage.getItem(KEYS.GEMINI_API_KEY);
    }
    return await SecureStore.getItemAsync(KEYS.GEMINI_API_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Securely save the Gemini API Key.
 */
export async function setGeminiApiKey(key: string): Promise<void> {
  const isAvailable = await SecureStore.isAvailableAsync();
  if (!isAvailable) {
    localStorage.setItem(KEYS.GEMINI_API_KEY, key);
    return;
  }
  await SecureStore.setItemAsync(KEYS.GEMINI_API_KEY, key);
}

/**
 * Securely delete the Gemini API Key.
 */
export async function deleteGeminiApiKey(): Promise<void> {
  const isAvailable = await SecureStore.isAvailableAsync();
  if (!isAvailable) {
    localStorage.removeItem(KEYS.GEMINI_API_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEYS.GEMINI_API_KEY);
}
