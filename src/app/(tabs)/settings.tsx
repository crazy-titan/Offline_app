import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Shield, Eye, EyeOff, Trash2, Database, Info, Moon, FileJson, RotateCcw } from 'lucide-react-native';
import {
  getThemePreference,
  setThemePreference,
  getGeminiApiKey,
  setGeminiApiKey,
  deleteGeminiApiKey,
  getForceOfflineFallbackPreference,
  setForceOfflineFallbackPreference,
  AppTheme
} from '@/services/preferences';
import { wipeDatabase, getAllSnippets } from '@/services/db';
import { SANDBOX_ROOT } from '@/services/files';
import { Colors, Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  // Theme preference
  const [themeMode, setThemeMode] = useState<AppTheme>('dark');
  
  // API Keys
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Fallback mode
  const [forceOffline, setForceOffline] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const activeTheme = await getThemePreference();
      setThemeMode(activeTheme);

      const savedKey = await getGeminiApiKey();
      setApiKey(savedKey || '');

      const isOffline = await getForceOfflineFallbackPreference();
      setForceOffline(isOffline);
    }
    loadSettings();
  }, []);

  const handleSaveTheme = async (mode: AppTheme) => {
    setThemeMode(mode);
    await setThemePreference(mode);
    Alert.alert('Theme Updated', 'Your theme preference has been saved.');
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key.');
      return;
    }
    await setGeminiApiKey(apiKey.trim());
    Alert.alert('API Key Saved', 'The Gemini API key has been securely stored.');
  };

  const handleClearApiKey = async () => {
    await deleteGeminiApiKey();
    setApiKey('');
    Alert.alert('API Key Removed', 'The Gemini API key has been deleted from secure storage.');
  };

  const handleToggleOffline = async (val: boolean) => {
    setForceOffline(val);
    await setForceOfflineFallbackPreference(val);
  };

  // Export database as JSON file
  const handleExportBackup = async () => {
    try {
      const snippets = await getAllSnippets();
      if (snippets.length === 0) {
        Alert.alert('No Data', 'You do not have any snippets to back up.');
        return;
      }

      const backupData = JSON.stringify(snippets, null, 2);
      const backupUri = `${FileSystem.cacheDirectory}snippets_backup_${Date.now()}.json`;

      await FileSystem.writeAsStringAsync(backupUri, backupData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(backupUri);
      } else {
        Alert.alert('Success', 'Backup saved inside app cache cache directory.');
      }
    } catch (e) {
      console.error('Backup failed:', e);
      Alert.alert('Error', 'Could not generate backup file.');
    }
  };

  // Wipe SQLite Database
  const handleWipeDatabase = () => {
    Alert.alert(
      'Wipe All Snippets',
      'This will permanently delete all snippets and associated screenshots. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Snippets',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Final Confirmation Required',
              'Are you absolutely sure? All local database data will be lost.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Wipe Everything',
                  style: 'destructive',
                  onPress: async () => {
                    await wipeDatabase();
                    Alert.alert('Reset Complete', 'All snippets have been deleted.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Wipe File System
  const handleWipeSandbox = () => {
    Alert.alert(
      'Wipe Developer Files',
      'This will delete all files and folders in your sandbox workspace. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Sandbox',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(SANDBOX_ROOT, { idempotent: true });
              await FileSystem.makeDirectoryAsync(SANDBOX_ROOT, { intermediates: true });
              Alert.alert('Success', 'The local file manager sandbox has been reset.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear sandbox directory.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* AI Config */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>AI Code Explainer</Text>
        <View style={[styles.card, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
          <View style={styles.settingRow}>
            <Shield size={20} color={activeColors.primary} style={styles.settingIcon} />
            <View style={styles.settingMeta}>
              <Text style={[styles.settingLabel, { color: activeColors.text }]}>Gemini API Key</Text>
              <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                API key is stored locally and securely using SecureStore.
              </Text>
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              placeholder="Enter AI API Key"
              placeholderTextColor={activeColors.textMuted}
              style={[styles.input, { color: activeColors.text, borderColor: activeColors.border }]}
            />
            <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.eyeBtn}>
              {showApiKey ? (
                <EyeOff size={18} color={activeColors.textSecondary} />
              ) : (
                <Eye size={18} color={activeColors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            {apiKey.length > 0 && (
              <TouchableOpacity onPress={handleClearApiKey} style={[styles.btn, styles.clearBtn]}>
                <Text style={{ color: activeColors.danger, fontWeight: '600' }}>Remove Key</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSaveApiKey}
              style={[styles.btn, styles.saveBtn, { backgroundColor: activeColors.primary }]}
            >
              <Text style={styles.saveBtnText}>Save Key</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

          <View style={styles.switchSetting}>
            <View style={styles.settingMeta}>
              <Text style={[styles.settingLabel, { color: activeColors.text }]}>Force Offline Mode</Text>
              <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                Skip API requests and use local AST text analyzer for summaries.
              </Text>
            </View>
            <Switch
              value={forceOffline}
              onValueChange={handleToggleOffline}
              thumbColor={forceOffline ? activeColors.primary : activeColors.textMuted}
              trackColor={{ false: activeColors.border, true: activeColors.primary + '50' }}
            />
          </View>
        </View>
      </View>

      {/* Theme Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Theme & Interface</Text>
        <View style={[styles.card, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
          <View style={styles.settingRow}>
            <Moon size={20} color={activeColors.accent} style={styles.settingIcon} />
            <View style={styles.settingMeta}>
              <Text style={[styles.settingLabel, { color: activeColors.text }]}>Application Theme</Text>
              <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                Choose between dark theme, light theme, or automatic matching.
              </Text>
            </View>
          </View>

          <View style={styles.themeSelectorRow}>
            {(['light', 'dark', 'system'] as AppTheme[]).map(mode => (
              <TouchableOpacity
                key={mode}
                onPress={() => handleSaveTheme(mode)}
                style={[
                  styles.themePill,
                  themeMode === mode
                    ? { backgroundColor: activeColors.primary }
                    : { backgroundColor: activeColors.backgroundSelected },
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    themeMode === mode ? { color: '#fff' } : { color: activeColors.text },
                    { textTransform: 'capitalize' },
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Database utilities */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Data & Utilities</Text>
        <View style={[styles.card, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
          {/* Backup */}
          <TouchableOpacity onPress={handleExportBackup} style={styles.utilityRow}>
            <View style={styles.utilityMeta}>
              <FileJson size={20} color={activeColors.success} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: activeColors.text }]}>Export Backup JSON</Text>
                <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                  Save all snippets in a portable JSON file.
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

          {/* Wipe DB */}
          <TouchableOpacity onPress={handleWipeDatabase} style={styles.utilityRow}>
            <View style={styles.utilityMeta}>
              <Trash2 size={20} color={activeColors.danger} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: activeColors.text }]}>Clear Saved Snippets</Text>
                <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                  Wipe all codes, tags, and attachment records.
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

          {/* Wipe Sandbox */}
          <TouchableOpacity onPress={handleWipeSandbox} style={styles.utilityRow}>
            <View style={styles.utilityMeta}>
              <RotateCcw size={20} color={activeColors.warning} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: activeColors.text }]}>Reset Developer Sandbox</Text>
                <Text style={[styles.settingDesc, { color: activeColors.textMuted }]}>
                  Permanently wipe all folders and resources.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info card */}
      <View style={[styles.section, { marginBottom: 60 }]}>
        <View style={[styles.infoCard, { backgroundColor: activeColors.backgroundSelected }]}>
          <Info size={16} color={activeColors.textSecondary} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: activeColors.textSecondary }]}>
            Offline Snippet Manager v1.0.0. Core functions are completely offline-first. SQLite DB path is managed securely by Expo.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  settingIcon: {
    marginTop: 2,
    marginRight: Spacing.one,
  },
  settingMeta: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  inputWrapper: {
    position: 'relative',
    marginTop: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  saveBtn: {
    elevation: 1,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.one,
  },
  switchSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  themePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  utilityRow: {
    paddingVertical: Spacing.one,
  },
  utilityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: Spacing.three,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
});
