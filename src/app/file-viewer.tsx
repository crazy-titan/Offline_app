import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Save, Share2, X, Eye, Edit2 } from 'lucide-react-native';
import { readTextFile, writeTextFile, getRelativePath } from '@/services/files';
import { Colors, Spacing } from '@/constants/theme';

export default function FileViewerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const fileUri = params.fileUri as string;
  const fileName = params.fileName as string;
  const relativePath = getRelativePath(fileUri);

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  // Load file content
  useEffect(() => {
    async function loadFile() {
      if (!fileUri) {
        Alert.alert('Error', 'Invalid file path.');
        router.back();
        return;
      }
      navigation.setOptions({ title: fileName || 'File Viewer' });
      try {
        const text = await readTextFile(relativePath);
        setContent(text);
        setOriginalContent(text);
      } catch (e) {
        console.error('Failed to read file:', e);
        Alert.alert('Error', 'Failed to read file contents. It might not be a valid text file.');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    loadFile();
  }, [fileUri]);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerIconBtn}>
            <Share2 size={20} color={activeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                // If editing, exit editor (prompt if changed)
                if (content !== originalContent) {
                  Alert.alert('Discard Changes', 'You have unsaved changes. Discard them?', [
                    { text: 'Keep Editing', style: 'cancel' },
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () => {
                        setContent(originalContent);
                        setIsEditing(false);
                      },
                    },
                  ]);
                } else {
                  setIsEditing(false);
                }
              } else {
                setIsEditing(true);
              }
            }}
            style={styles.headerIconBtn}
          >
            {isEditing ? (
              <Eye size={20} color={activeColors.primary} />
            ) : (
              <Edit2 size={20} color={activeColors.text} />
            )}
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity onPress={handleSave} style={styles.headerIconBtn}>
              <Save size={20} color={activeColors.success} />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [content, originalContent, isEditing, activeColors]);

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);
      await writeTextFile(relativePath, content);
      setOriginalContent(content);
      setIsEditing(false);
      Alert.alert('Success', 'File changes saved successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save file changes.');
    } finally {
      setLoading(false);
    }
  };

  // Share file
  const handleShare = async () => {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      Alert.alert('Sharing Unavailable', 'This device does not support native sharing.');
      return;
    }
    try {
      await Sharing.shareAsync(fileUri);
    } catch (e) {
      console.warn('Sharing failed:', e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: activeColors.background }]}>
        <ActivityIndicator size="large" color={activeColors.primary} />
      </View>
    );
  }

  // Split lines for line numbers
  const lines = content.split('\n');

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Editor Warning Pill */}
      {isEditing && (
        <View style={[styles.editWarning, { backgroundColor: activeColors.primary + '15' }]}>
          <Text style={[styles.editWarningText, { color: activeColors.primary }]}>
            You are editing: {fileName}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.codeBlock, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
          <View style={[styles.lineNumbers, { borderRightColor: activeColors.border }]}>
            {lines.map((_, idx) => (
              <Text key={idx} style={[styles.lineNumberText, { color: activeColors.textMuted }]}>
                {idx + 1}
              </Text>
            ))}
          </View>

          <View style={styles.codeWrapper}>
            {isEditing ? (
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                scrollEnabled={false} // handled by outer ScrollView
                style={[
                  styles.codeInputText,
                  { color: activeColors.text, fontFamily: 'monospace' },
                ]}
              />
            ) : (
              <Text style={[styles.codeText, { color: activeColors.text, fontFamily: 'monospace' }]}>
                {content || ' '}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginRight: Spacing.one,
  },
  headerIconBtn: {
    padding: 6,
  },
  editWarning: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  editWarningText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: Spacing.three,
    flexGrow: 1,
  },
  codeBlock: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: '100%',
    paddingVertical: Spacing.two,
    overflow: 'hidden',
  },
  lineNumbers: {
    paddingLeft: Spacing.two,
    paddingRight: Spacing.one,
    borderRightWidth: 1,
    alignItems: 'flex-end',
    minWidth: 36,
  },
  lineNumberText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  codeWrapper: {
    flex: 1,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
  },
  codeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  codeInputText: {
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: 'top',
    padding: 0,
  },
});
