import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Folder,
  FileCode,
  FolderPlus,
  FilePlus,
  ArrowUp,
  Trash2,
  Copy,
  Move,
  Share2,
  ChevronRight,
  Download,
  X,
  FileSpreadsheet
} from 'lucide-react-native';
import {
  listDirectory,
  createFolder,
  writeTextFile,
  deleteItem,
  copyItem,
  moveItem,
  getRelativePath,
  DEV_TEMPLATES,
  DevTemplate,
} from '@/services/files';
import { Colors, Spacing } from '@/constants/theme';

export default function FileManagerScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const [currentDir, setCurrentDir] = useState<string>(''); // relative path
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DevTemplate | null>(null);

  // Cut/Copy Operations State
  const [clipboard, setClipboard] = useState<{
    type: 'copy' | 'move';
    sourceRelPath: string;
    sourceName: string;
  } | null>(null);

  // Load files in the active directory
  const loadDirectoryContents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDirectory(currentDir);
      setItems(data);
    } catch (error) {
      console.error('Error loading folder contents:', error);
      Alert.alert('Error', 'Could not open folder');
    } finally {
      setLoading(false);
    }
  }, [currentDir]);

  useEffect(() => {
    loadDirectoryContents();
  }, [loadDirectoryContents]);

  // Navigate deeper into a subdirectory
  const navigateToFolder = (folderName: string) => {
    const nextPath = currentDir ? `${currentDir}/${folderName}` : folderName;
    setCurrentDir(nextPath);
  };

  // Navigate back to the parent directory
  const navigateUp = () => {
    if (!currentDir) return;
    const parts = currentDir.split('/');
    parts.pop();
    setCurrentDir(parts.join('/'));
  };

  // Format breadcrumbs for presentation
  const renderBreadcrumbs = () => {
    if (!currentDir) return <Text style={[styles.breadcrumbText, { color: activeColors.textSecondary }]}>Root</Text>;
    
    const parts = currentDir.split('/');
    return (
      <View style={styles.breadcrumbContainer}>
        <TouchableOpacity onPress={() => setCurrentDir('')}>
          <Text style={[styles.breadcrumbText, { color: activeColors.primary }]}>Root</Text>
        </TouchableOpacity>
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          const targetPath = parts.slice(0, index + 1).join('/');
          return (
            <React.Fragment key={index}>
              <ChevronRight size={14} color={activeColors.textMuted} />
              <TouchableOpacity disabled={isLast} onPress={() => setCurrentDir(targetPath)}>
                <Text
                  style={[
                    styles.breadcrumbText,
                    isLast ? { color: activeColors.text } : { color: activeColors.primary },
                  ]}
                >
                  {part}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  // Folder Actions
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(currentDir, newFolderName.trim());
      setFolderModalVisible(false);
      setNewFolderName('');
      loadDirectoryContents();
    } catch (e) {
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  // File Actions
  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const cleanName = newFileName.trim();
    const relFilePath = currentDir ? `${currentDir}/${cleanName}` : cleanName;
    try {
      await writeTextFile(relFilePath, newFileContent);
      setFileModalVisible(false);
      setNewFileName('');
      setNewFileContent('');
      loadDirectoryContents();
    } catch (e) {
      Alert.alert('Error', 'Failed to save file');
    }
  };

  // Template Actions
  const handleDownloadTemplate = async (template: DevTemplate) => {
    const relPath = currentDir ? `${currentDir}/${template.fileName}` : template.fileName;
    try {
      await writeTextFile(relPath, template.content);
      setSelectedTemplate(null);
      setTemplateModalVisible(false);
      loadDirectoryContents();
      Alert.alert('Success', `Saved "${template.fileName}" to active folder.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save template');
    }
  };

  // Item Options: Delete, Copy, Move, Share
  const handleDelete = (item: any) => {
    const relPath = getRelativePath(item.uri);
    Alert.alert(
      'Delete Item',
      `Are you sure you want to permanently delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteItem(relPath);
            loadDirectoryContents();
          },
        },
      ]
    );
  };

  const handleShare = async (item: any) => {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      Alert.alert('Sharing Unavailable', 'This device does not support native sharing.');
      return;
    }
    try {
      await Sharing.shareAsync(item.uri);
    } catch (e) {
      console.warn('Sharing file failed:', e);
    }
  };

  const prepareCopy = (item: any) => {
    setClipboard({
      type: 'copy',
      sourceRelPath: getRelativePath(item.uri),
      sourceName: item.name,
    });
  };

  const prepareMove = (item: any) => {
    setClipboard({
      type: 'move',
      sourceRelPath: getRelativePath(item.uri),
      sourceName: item.name,
    });
  };

  const executePaste = async () => {
    if (!clipboard) return;
    const destRelPath = currentDir ? `${currentDir}/${clipboard.sourceName}` : clipboard.sourceName;
    try {
      if (clipboard.type === 'copy') {
        await copyItem(clipboard.sourceRelPath, destRelPath);
      } else {
        await moveItem(clipboard.sourceRelPath, destRelPath);
      }
      setClipboard(null);
      loadDirectoryContents();
    } catch (e) {
      Alert.alert('Error', 'Failed to copy or move item. Make sure name is unique.');
    }
  };

  // Helper for displaying sizes nicely
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* File Action Controls */}
      <View style={[styles.actionsRow, { borderBottomColor: activeColors.border }]}>
        <TouchableOpacity
          onPress={() => setFolderModalVisible(true)}
          style={[styles.actionBtn, { backgroundColor: activeColors.backgroundElement }]}
        >
          <FolderPlus size={16} color={activeColors.primary} />
          <Text style={[styles.actionBtnText, { color: activeColors.text }]}>New Folder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFileModalVisible(true)}
          style={[styles.actionBtn, { backgroundColor: activeColors.backgroundElement }]}
        >
          <FilePlus size={16} color={activeColors.primary} />
          <Text style={[styles.actionBtnText, { color: activeColors.text }]}>New File</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTemplateModalVisible(true)}
          style={[styles.actionBtn, { backgroundColor: activeColors.backgroundElement }]}
        >
          <Download size={16} color={activeColors.accent} />
          <Text style={[styles.actionBtnText, { color: activeColors.text }]}>Templates</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Header */}
      <View style={[styles.navigationHeader, { backgroundColor: activeColors.backgroundSelected }]}>
        <View style={styles.breadcrumbWrapper}>
          {currentDir.length > 0 && (
            <TouchableOpacity onPress={navigateUp} style={styles.upBtn}>
              <ArrowUp size={16} color={activeColors.primary} />
            </TouchableOpacity>
          )}
          {renderBreadcrumbs()}
        </View>

        {clipboard && (
          <View style={styles.clipboardPanel}>
            <Text style={[styles.clipboardText, { color: activeColors.text }]}>
              Selected: <Text style={{ fontWeight: 'bold' }}>{clipboard.sourceName}</Text> ({clipboard.type})
            </Text>
            <View style={styles.clipboardActions}>
              <TouchableOpacity
                onPress={executePaste}
                style={[styles.pasteBtn, { backgroundColor: activeColors.primary }]}
              >
                <Text style={styles.pasteBtnText}>Paste here</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setClipboard(null)} style={styles.cancelPasteBtn}>
                <X size={16} color={activeColors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* List Files */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={activeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.uri}
          contentContainerStyle={[styles.listContent, items.length === 0 && styles.emptyList]}
          renderItem={({ item }) => (
            <View style={[styles.fileRow, { borderBottomColor: activeColors.border }]}>
              <TouchableOpacity
                style={styles.fileClickArea}
                onPress={() => {
                  if (item.isDirectory) {
                    navigateToFolder(item.name);
                  } else {
                    router.push({
                      pathname: '/file-viewer',
                      params: { fileUri: item.uri, fileName: item.name },
                    });
                  }
                }}
              >
                {item.isDirectory ? (
                  <Folder size={24} color={activeColors.primary} style={styles.itemIcon} />
                ) : (
                  <FileCode size={24} color={activeColors.accent} style={styles.itemIcon} />
                )}
                <View style={styles.itemMeta}>
                  <Text style={[styles.itemName, { color: activeColors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!item.isDirectory && (
                    <Text style={[styles.itemSize, { color: activeColors.textMuted }]}>
                      {formatBytes(item.sizeBytes)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.optionsArea}>
                {!item.isDirectory && (
                  <TouchableOpacity onPress={() => handleShare(item)} style={styles.iconOptionBtn}>
                    <Share2 size={16} color={activeColors.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => prepareCopy(item)} style={styles.iconOptionBtn}>
                  <Copy size={16} color={activeColors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => prepareMove(item)} style={styles.iconOptionBtn}>
                  <Move size={16} color={activeColors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconOptionBtn}>
                  <Trash2 size={16} color={activeColors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FileSpreadsheet size={48} color={activeColors.textMuted} style={{ marginBottom: Spacing.two }} />
              <Text style={[styles.emptyTitle, { color: activeColors.text }]}>Empty Directory</Text>
              <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
                This folder has no files. Add folders, write code files, or select from Templates above!
              </Text>
            </View>
          }
        />
      )}

      {/* CREATE FOLDER MODAL */}
      <Modal visible={folderModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: activeColors.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Create Folder</Text>
            <TextInput
              placeholder="Folder Name"
              placeholderTextColor={activeColors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
              style={[styles.modalInput, { color: activeColors.text, borderColor: activeColors.border }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setFolderModalVisible(false)} style={styles.cancelBtn}>
                <Text style={{ color: activeColors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFolder}
                style={[styles.confirmBtn, { backgroundColor: activeColors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE FILE MODAL */}
      <Modal visible={fileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.fileModalCard, { backgroundColor: activeColors.backgroundElement }]}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>New Code File</Text>
            <TextInput
              placeholder="filename.js (or .txt, .json)"
              placeholderTextColor={activeColors.textMuted}
              value={newFileName}
              onChangeText={setNewFileName}
              style={[styles.modalInput, { color: activeColors.text, borderColor: activeColors.border }]}
            />
            <TextInput
              placeholder="Write your code or note contents here..."
              placeholderTextColor={activeColors.textMuted}
              value={newFileContent}
              onChangeText={setNewFileContent}
              multiline
              numberOfLines={8}
              style={[
                styles.modalInput,
                styles.multilineInput,
                { color: activeColors.text, borderColor: activeColors.border, fontFamily: 'monospace' },
              ]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setFileModalVisible(false)} style={styles.cancelBtn}>
                <Text style={{ color: activeColors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFile}
                style={[styles.confirmBtn, { backgroundColor: activeColors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TEMPLATES LIST MODAL */}
      <Modal visible={templateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.templateModalCard, { backgroundColor: activeColors.backgroundElement }]}>
            <View style={styles.templateModalHeader}>
              <Text style={[styles.modalTitle, { color: activeColors.text }]}>Boilerplate Templates</Text>
              <TouchableOpacity onPress={() => setTemplateModalVisible(false)}>
                <X size={20} color={activeColors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={DEV_TEMPLATES}
              keyExtractor={item => item.name}
              style={{ maxHeight: 350 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.templateRow,
                    {
                      borderColor: activeColors.border,
                      backgroundColor:
                        selectedTemplate?.name === item.name
                          ? activeColors.backgroundSelected
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedTemplate(item)}
                >
                  <Text style={[styles.templateName, { color: activeColors.text }]}>{item.name}</Text>
                  <Text style={[styles.templateDesc, { color: activeColors.textSecondary }]}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {selectedTemplate && (
              <View style={styles.templatePreviewPanel}>
                <Text style={[styles.previewLabel, { color: activeColors.textMuted }]}>
                  Preview ({selectedTemplate.fileName}):
                </Text>
                <Text
                  style={[
                    styles.previewText,
                    { color: activeColors.textSecondary, backgroundColor: activeColors.backgroundSelected },
                  ]}
                  numberOfLines={4}
                >
                  {selectedTemplate.content.trim()}
                </Text>
                <TouchableOpacity
                  style={[styles.templateSaveBtn, { backgroundColor: activeColors.accent }]}
                  onPress={() => handleDownloadTemplate(selectedTemplate)}
                >
                  <Download size={16} color="#fff" />
                  <Text style={styles.templateSaveBtnText}>Save Template to folder</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  navigationHeader: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.two,
    gap: 8,
  },
  breadcrumbWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upBtn: {
    marginRight: Spacing.one,
    padding: 4,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clipboardPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  clipboardText: {
    fontSize: 12,
    flex: 1,
  },
  clipboardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pasteBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cancelPasteBtn: {
    padding: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
  },
  fileClickArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.one,
  },
  itemIcon: {
    marginRight: Spacing.two,
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSize: {
    fontSize: 11,
    marginTop: 2,
  },
  optionsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconOptionBtn: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
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
  fileModalCard: {
    height: '65%',
  },
  templateModalCard: {
    maxHeight: '80%',
    gap: Spacing.two,
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontSize: 14,
  },
  multilineInput: {
    flex: 1,
    textAlignVertical: 'top',
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
  templateRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    marginBottom: Spacing.one,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '700',
  },
  templateDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  templatePreviewPanel: {
    marginTop: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: Spacing.two,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    padding: Spacing.two,
    borderRadius: 6,
  },
  templateSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  templateSaveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
