import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Clipboard,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Heart,
  Edit,
  Trash2,
  Copy,
  Share2,
  FileDown,
  Sparkles,
  Image as ImageIcon,
  X,
  ChevronRight,
  ExternalLink,
  BookOpen
} from 'lucide-react-native';
import {
  getSnippet,
  deleteSnippet,
  toggleFavorite,
  updateSnippetExplanation,
  addAttachment,
  getAttachments,
  deleteAttachment,
  Snippet,
  Attachment,
} from '@/services/db';
import { copyToAttachments, deleteAttachmentFile, writeTextFile } from '@/services/files';
import { explainCode, ExplanationResponse } from '@/services/ai';
import { Colors, Spacing } from '@/constants/theme';

export default function SnippetDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const snippetId = parseInt(params.id as string, 10);

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  // Export Modal
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'js' | 'json'>('txt');
  const [exportFileName, setExportFileName] = useState('');

  // Fullscreen Image Modal
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Load snippet and attachments
  const loadSnippetDetails = useCallback(async () => {
    try {
      const data = await getSnippet(snippetId);
      if (data) {
        setSnippet(data);
        const files = await getAttachments(snippetId);
        setAttachments(files);
        // Set default filename in export modal
        setExportFileName(data.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
      } else {
        Alert.alert('Error', 'Snippet not found');
        router.back();
      }
    } catch (e) {
      console.error('Error loading snippet details:', e);
    } finally {
      setLoading(false);
    }
  }, [snippetId]);

  useFocusEffect(
    useCallback(() => {
      loadSnippetDetails();
    }, [loadSnippetDetails])
  );

  // Dynamic header buttons
  useEffect(() => {
    if (!snippet) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={async () => {
              await toggleFavorite(snippet.id, !snippet.is_favorite);
              setSnippet(prev => (prev ? { ...prev, is_favorite: !prev.is_favorite } : null));
            }}
            style={styles.headerIconBtn}
          >
            <Heart
              size={20}
              color={snippet.is_favorite ? activeColors.danger : activeColors.text}
              fill={snippet.is_favorite ? activeColors.danger : 'transparent'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/snippet/create?id=${snippet.id}`)}
            style={styles.headerIconBtn}
          >
            <Edit size={20} color={activeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn}>
            <Trash2 size={20} color={activeColors.danger} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [snippet, activeColors]);

  // Copy code to Clipboard
  const handleCopyCode = () => {
    if (!snippet) return;
    Clipboard.setString(snippet.code);
    Alert.alert('Copied!', 'Code snippet copied to clipboard.');
  };

  // Delete Snippet
  const handleDelete = () => {
    Alert.alert(
      'Delete Snippet',
      'Are you sure you want to permanently delete this snippet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete all local attachment files first
            for (const att of attachments) {
              await deleteAttachmentFile(att.file_path);
            }
            await deleteSnippet(snippetId);
            router.back();
          },
        },
      ]
    );
  };

  // Pick Screenshot
  const handleAttachScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Gallery access is required to attach screenshots.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const selected = result.assets[0];
      try {
        const originalName = selected.fileName || 'screenshot.jpg';
        const copied = await copyToAttachments(selected.uri, originalName);

        // Add to database
        const att = await addAttachment(snippetId, copied.relativePath, originalName, 'image/jpeg');
        setAttachments([...attachments, att]);
      } catch (e) {
        console.error('Failed to attach image:', e);
        Alert.alert('Error', 'Failed to save attached image locally.');
      }
    }
  };

  // Remove Screenshot
  const handleRemoveAttachment = async (att: Attachment) => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this attached screenshot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAttachmentFile(att.file_path);
              await deleteAttachment(att.id);
              setAttachments(prev => prev.filter(a => a.id !== att.id));
            } catch (e) {
              Alert.alert('Error', 'Failed to remove attachment file.');
            }
          },
        },
      ]
    );
  };

  // Explain with AI
  const handleExplainCode = async () => {
    if (!snippet) return;
    setAiLoading(true);
    try {
      const resp = await explainCode(snippet.code, snippet.language, snippet.title);
      
      // Combine text segments into a single string for storage
      const fullExplanation = `
### Summary
${resp.summary}

### Explanation
${resp.explanation}

### Suggestions
${resp.suggestions}
      `.trim();

      await updateSnippetExplanation(snippet.id, fullExplanation);
      setSnippet(prev => (prev ? { ...prev, explanation: fullExplanation } : null));

      if (resp.isOffline) {
        Alert.alert('Offline Mode', 'Internet or API key not found. Generated local structural explanation.');
      } else {
        Alert.alert('Success', 'AI explanation loaded and cached offline.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('AI Explainer Error', 'Failed to retrieve code explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  // Export File Locally
  const handleExportFile = async () => {
    if (!snippet) return;
    const extension = exportFormat;
    const finalFileName = `${exportFileName}.${extension}`;

    let fileContent = '';
    if (exportFormat === 'json') {
      fileContent = JSON.stringify(
        {
          title: snippet.title,
          language: snippet.language,
          tags: snippet.tags,
          code: snippet.code,
          created_at: snippet.created_at,
        },
        null,
        2
      );
    } else if (exportFormat === 'js') {
      fileContent = `// Exported from Offline Code Snippet Manager\n// Title: ${snippet.title}\n// Language: ${snippet.language}\n// Tags: ${snippet.tags.join(', ')}\n\n${snippet.code}`;
    } else {
      fileContent = `Title: ${snippet.title}\nLanguage: ${snippet.language}\nTags: ${snippet.tags.join(', ')}\nCreated: ${snippet.created_at}\n\nCode:\n${snippet.code}`;
    }

    try {
      await writeTextFile(finalFileName, fileContent);
      setExportModalVisible(false);
      Alert.alert('Export Success', `Saved file "${finalFileName}" to your local File Manager.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to export file to sandbox.');
    }
  };

  // Native Share
  const handleShare = async () => {
    if (!snippet) return;
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (!isShareAvailable) {
      Alert.alert('Share Error', 'This device does not support native sharing.');
      return;
    }

    // Write temp file to share
    const tempFileUri = `${FileSystem.cacheDirectory}${snippet.title.replace(/[^a-zA-Z0-9]/g, '_')}.${snippet.language === 'javascript' ? 'js' : 'txt'}`;
    await FileSystem.writeAsStringAsync(tempFileUri, snippet.code, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    try {
      await Sharing.shareAsync(tempFileUri);
    } catch (e) {
      console.warn('Share operation cancelled or failed');
    }
  };

  // A very clean custom parser for explanation paragraphs
  const renderMarkdownExplanation = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return (
          <Text key={index} style={[styles.mdH3, { color: activeColors.text, borderBottomColor: activeColors.border }]}>
            {trimmed.replace('###', '').trim()}
          </Text>
        );
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <View key={index} style={styles.mdListItem}>
            <Text style={{ color: activeColors.primary, fontSize: 14 }}>• </Text>
            <Text style={[styles.mdListText, { color: activeColors.textSecondary }]}>
              {trimmed.substring(1).trim()}
            </Text>
          </View>
        );
      }
      if (/^\d+\./.test(trimmed)) {
        const dotIndex = trimmed.indexOf('.');
        const number = trimmed.substring(0, dotIndex + 1);
        const rest = trimmed.substring(dotIndex + 1).trim();
        return (
          <View key={index} style={styles.mdListItem}>
            <Text style={{ color: activeColors.primary, fontSize: 13, fontWeight: '700' }}>{number} </Text>
            <Text style={[styles.mdListText, { color: activeColors.textSecondary }]}>{rest}</Text>
          </View>
        );
      }
      if (trimmed === '') return <View key={index} style={{ height: Spacing.one }} />;

      return (
        <Text key={index} style={[styles.mdParagraph, { color: activeColors.textSecondary }]}>
          {trimmed}
        </Text>
      );
    });
  };

  if (loading || !snippet) {
    return (
      <View style={[styles.loader, { backgroundColor: activeColors.background }]}>
        <ActivityIndicator size="large" color={activeColors.primary} />
      </View>
    );
  }

  // Pre-split code into line array for layout representation
  const codeLines = snippet.code.split('\n');

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Title Header */}
      <View style={styles.titleSection}>
        <Text style={[styles.title, { color: activeColors.text }]}>{snippet.title}</Text>
        
        {/* Badges & Tags */}
        <View style={styles.metaRow}>
          <View style={[styles.langBadge, { backgroundColor: activeColors.primary + '20' }]}>
            <Text style={[styles.langText, { color: activeColors.primary }]}>
              {snippet.language}
            </Text>
          </View>

          <View style={styles.tagCloud}>
            {snippet.tags.map(tag => (
              <View key={tag} style={[styles.tagBadge, { backgroundColor: activeColors.backgroundSelected }]}>
                <Text style={[styles.tagText, { color: activeColors.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Code Viewer Panel */}
      <View style={[styles.codeContainer, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
        <View style={[styles.codeHeader, { borderBottomColor: activeColors.border }]}>
          <Text style={[styles.codeHeaderTitle, { color: activeColors.textMuted }]}>SOURCE CODE</Text>
          <View style={styles.codeHeaderActions}>
            <TouchableOpacity onPress={handleCopyCode} style={styles.codeActionBtn}>
              <Copy size={16} color={activeColors.primary} />
              <Text style={[styles.codeActionBtnText, { color: activeColors.primary }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.codeActionBtn}>
              <Share2 size={16} color={activeColors.accent} />
              <Text style={[styles.codeActionBtnText, { color: activeColors.accent }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setExportModalVisible(true)} style={styles.codeActionBtn}>
              <FileDown size={16} color={activeColors.success} />
              <Text style={[styles.codeActionBtnText, { color: activeColors.success }]}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.codeRowBlock}>
            {/* Line numbers column */}
            <View style={[styles.lineNumbersColumn, { borderRightColor: activeColors.border }]}>
              {codeLines.map((_, idx) => (
                <Text key={idx} style={[styles.lineNumberText, { color: activeColors.textMuted }]}>
                  {idx + 1}
                </Text>
              ))}
            </View>

            {/* Code lines column */}
            <View style={styles.codeTextColumn}>
              {codeLines.map((line, idx) => (
                <Text key={idx} style={[styles.codeLineText, { color: activeColors.text }]}>
                  {line || ' '}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Attachments Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Attached Screenshots</Text>
          <TouchableOpacity onPress={handleAttachScreenshot} style={styles.attachBtn}>
            <ImageIcon size={14} color={activeColors.primary} />
            <Text style={[styles.attachBtnText, { color: activeColors.primary }]}>Add Image</Text>
          </TouchableOpacity>
        </View>

        {attachments.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentsList}>
            {attachments.map(att => {
              const fullUri = `${FileSystem.documentDirectory}${att.file_path}`;
              return (
                <View key={att.id} style={[styles.attachmentCard, { borderColor: activeColors.border }]}>
                  <TouchableOpacity onPress={() => setSelectedImageUri(fullUri)}>
                    <Image source={{ uri: fullUri }} style={styles.attachmentThumb} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(att)}
                    style={styles.deleteAttachmentBtn}
                  >
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.emptySectionBox, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
            <Text style={[styles.emptySectionText, { color: activeColors.textMuted }]}>
              No screenshots attached to this snippet.
            </Text>
          </View>
        )}
      </View>

      {/* AI Explanation Section */}
      <View style={[styles.section, { marginBottom: 60 }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>AI Analysis & Explanation</Text>
          {snippet.explanation && (
            <TouchableOpacity onPress={handleExplainCode} style={styles.regenerateBtn} disabled={aiLoading}>
              <Sparkles size={14} color={activeColors.accent} />
              <Text style={{ color: activeColors.accent, fontSize: 11, fontWeight: '700' }}>Regenerate</Text>
            </TouchableOpacity>
          )}
        </View>

        {aiLoading ? (
          <View style={[styles.aiLoaderCard, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
            <ActivityIndicator size="small" color={activeColors.primary} style={{ marginBottom: Spacing.one }} />
            <Text style={[styles.aiLoaderText, { color: activeColors.text }]}>Analyzing code syntax...</Text>
            <Text style={[styles.aiLoaderSub, { color: activeColors.textSecondary }]}>
              Processing structures and generating suggestions.
            </Text>
          </View>
        ) : snippet.explanation ? (
          <View style={[styles.explanationCard, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
            {renderMarkdownExplanation(snippet.explanation)}
          </View>
        ) : (
          <View style={[styles.emptyAiCard, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.border }]}>
            <BookOpen size={24} color={activeColors.textMuted} style={{ marginBottom: Spacing.one }} />
            <Text style={[styles.emptyAiTitle, { color: activeColors.text }]}>No Explanation Yet</Text>
            <Text style={[styles.emptyAiDesc, { color: activeColors.textSecondary }]}>
              Generate a local offline analysis or online Gemini code breakdown for this snippet.
            </Text>
            <TouchableOpacity
              onPress={handleExplainCode}
              style={[styles.explainBtn, { backgroundColor: activeColors.primary }]}
            >
              <Sparkles size={16} color="#fff" />
              <Text style={styles.explainBtnText}>Explain Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* EXPORT FILE MODAL */}
      <Modal visible={exportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: activeColors.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Export Snippet</Text>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>File Name</Text>
              <TextInput
                value={exportFileName}
                onChangeText={setExportFileName}
                placeholder="filename"
                placeholderTextColor={activeColors.textMuted}
                style={[styles.modalInput, { color: activeColors.text, borderColor: activeColors.border }]}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Export Format</Text>
              <View style={styles.formatSelector}>
                {(['txt', 'js', 'json'] as const).map(fmt => (
                  <TouchableOpacity
                    key={fmt}
                    onPress={() => setExportFormat(fmt)}
                    style={[
                      styles.formatOption,
                      exportFormat === fmt
                        ? { backgroundColor: activeColors.primary }
                        : { backgroundColor: activeColors.backgroundSelected },
                    ]}
                  >
                    <Text
                      style={[
                        styles.formatOptionText,
                        exportFormat === fmt ? { color: '#fff' } : { color: activeColors.text },
                      ]}
                    >
                      .{fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setExportModalVisible(false)} style={styles.cancelBtn}>
                <Text style={{ color: activeColors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExportFile}
                style={[styles.confirmBtn, { backgroundColor: activeColors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Export File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN IMAGE MODAL */}
      <Modal visible={!!selectedImageUri} animationType="fade" transparent>
        <View style={styles.imageOverlay}>
          <TouchableOpacity onPress={() => setSelectedImageUri(null)} style={styles.closeImageOverlayBtn}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {selectedImageUri && (
            <Image source={{ uri: selectedImageUri }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginRight: Spacing.one,
  },
  headerIconBtn: {
    padding: 6,
  },
  titleSection: {
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  langBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    flex: 1,
  },
  tagBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  codeContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
  },
  codeHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codeHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  codeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codeRowBlock: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
  },
  lineNumbersColumn: {
    paddingLeft: Spacing.two,
    paddingRight: Spacing.one,
    borderRightWidth: 1,
    alignItems: 'flex-end',
    minWidth: 32,
  },
  lineNumberText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  codeTextColumn: {
    paddingLeft: Spacing.two,
    paddingRight: Spacing.four,
  },
  codeLineText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  attachmentsList: {
    paddingVertical: 4,
    gap: Spacing.two,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 8,
    position: 'relative',
    overflow: 'visible',
  },
  attachmentThumb: {
    width: 100,
    height: 100,
    borderRadius: 7,
  },
  deleteAttachmentBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  emptySectionBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: Spacing.three,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiLoaderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
  },
  aiLoaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiLoaderSub: {
    fontSize: 11,
    marginTop: 2,
  },
  explanationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  emptyAiCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.four,
    alignItems: 'center',
  },
  emptyAiTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  emptyAiDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginVertical: Spacing.two,
    lineHeight: 16,
  },
  explainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: Spacing.one,
  },
  explainBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mdH3: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  mdParagraph: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.one,
  },
  mdListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: Spacing.one,
  },
  mdListText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.one,
  },
  formField: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 14,
  },
  formatSelector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formatOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  formatOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageOverlayBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
