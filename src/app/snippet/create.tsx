import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronDown, Plus, X, Search, Check } from 'lucide-react-native';
import { createSnippet, updateSnippet, getSnippet } from '@/services/db';
import { getDefaultLanguagePreference } from '@/services/preferences';
import { Colors, Spacing } from '@/constants/theme';

const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'tsx', 'html', 'css', 
  'python', 'sql', 'json', 'shell', 'rust', 
  'cpp', 'java', 'go', 'ruby', 'swift', 'markdown'
].sort();

export default function CreateSnippetScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const editId = params.id ? parseInt(params.id as string, 10) : null;

  // Form Fields
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Picker States
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [searchLangQuery, setSearchLangQuery] = useState('');

  // Initial load
  useEffect(() => {
    async function loadForm() {
      if (editId) {
        // Mode: Edit Snippet
        navigation.setOptions({ title: 'Edit Snippet' });
        const snippet = await getSnippet(editId);
        if (snippet) {
          setTitle(snippet.title);
          setCode(snippet.code);
          setLanguage(snippet.language);
          setTags(snippet.tags);
          setIsFavorite(snippet.is_favorite);
          setExplanation(snippet.explanation);
        } else {
          Alert.alert('Error', 'Snippet not found');
          router.back();
        }
      } else {
        // Mode: Create Snippet
        navigation.setOptions({ title: 'New Snippet' });
        const defaultLang = await getDefaultLanguagePreference();
        setLanguage(defaultLang);
      }
    }
    loadForm();
  }, [editId]);

  // Add tag to the tag list
  const handleAddTag = () => {
    const cleanTag = newTag.trim().toLowerCase();
    if (!cleanTag) return;
    if (tags.includes(cleanTag)) {
      setNewTag('');
      return;
    }
    setTags([...tags, cleanTag]);
    setNewTag('');
  };

  // Remove tag from list
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Save the form
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for your snippet.');
      return;
    }
    if (!code.trim()) {
      Alert.alert('Required Field', 'Please enter some code.');
      return;
    }
    if (!language) {
      Alert.alert('Required Field', 'Please select a programming language.');
      return;
    }

    try {
      if (editId) {
        // Update database record
        await updateSnippet(
          editId,
          title.trim(),
          code.trim(),
          language.toLowerCase(),
          tags,
          isFavorite,
          explanation
        );
      } else {
        // Insert new database record
        await createSnippet(
          title.trim(),
          code.trim(),
          language.toLowerCase(),
          tags,
          isFavorite,
          null
        );
      }
      router.back();
    } catch (e) {
      console.error('Error saving snippet:', e);
      Alert.alert('Error', 'Failed to save snippet.');
    }
  };

  // Language filtering
  const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
    lang.toLowerCase().includes(searchLangQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Title Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: activeColors.textSecondary }]}>Title</Text>
          <TextInput
            placeholder="e.g. Debounce Function, Binary Search"
            placeholderTextColor={activeColors.textMuted}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { color: activeColors.text, borderColor: activeColors.border }]}
          />
        </View>

        {/* Language Selection */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: activeColors.textSecondary }]}>Language</Text>
          <TouchableOpacity
            style={[styles.pickerTrigger, { borderColor: activeColors.border, backgroundColor: activeColors.backgroundElement }]}
            onPress={() => setLangPickerVisible(true)}
          >
            <Text style={[styles.pickerTriggerText, { color: language ? activeColors.text : activeColors.textMuted }]}>
              {language ? language.toUpperCase() : 'Select Language'}
            </Text>
            <ChevronDown size={18} color={activeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Code Block Editor */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: activeColors.textSecondary }]}>Code Content</Text>
          <TextInput
            placeholder="// Write or paste your code snippet here..."
            placeholderTextColor={activeColors.textMuted}
            value={code}
            onChangeText={setCode}
            multiline
            style={[
              styles.codeInput,
              {
                color: activeColors.text,
                borderColor: activeColors.border,
                backgroundColor: activeColors.backgroundElement,
              },
            ]}
          />
        </View>

        {/* Interactive Tags Builder */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: activeColors.textSecondary }]}>Tags</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              placeholder="e.g. react, hooks, api"
              placeholderTextColor={activeColors.textMuted}
              value={newTag}
              onChangeText={setNewTag}
              onSubmitEditing={handleAddTag}
              style={[styles.tagInput, { color: activeColors.text, borderColor: activeColors.border }]}
            />
            <TouchableOpacity
              onPress={handleAddTag}
              style={[styles.addTagBtn, { backgroundColor: activeColors.primary }]}
            >
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {tags.length > 0 && (
            <View style={styles.tagCloud}>
              {tags.map(tag => (
                <View key={tag} style={[styles.tagPill, { backgroundColor: activeColors.backgroundSelected }]}>
                  <Text style={[styles.tagPillText, { color: activeColors.text }]}>#{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.removeTagBtn}>
                    <X size={12} color={activeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={{ color: activeColors.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          >
            <Text style={styles.saveBtnText}>{editId ? 'Save Changes' : 'Create Snippet'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* LANGUAGE PICKER MODAL */}
      <Modal visible={langPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: activeColors.backgroundElement }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: activeColors.text }]}>Choose Language</Text>
              <TouchableOpacity onPress={() => setLangPickerVisible(false)}>
                <X size={20} color={activeColors.text} />
              </TouchableOpacity>
            </View>

            {/* Language Search */}
            <View style={[styles.searchBox, { backgroundColor: activeColors.backgroundSelected }]}>
              <Search size={16} color={activeColors.textSecondary} style={{ marginRight: Spacing.one }} />
              <TextInput
                placeholder="Search languages..."
                placeholderTextColor={activeColors.textMuted}
                value={searchLangQuery}
                onChangeText={setSearchLangQuery}
                style={[styles.searchInput, { color: activeColors.text }]}
              />
            </View>

            {/* Language List */}
            <FlatList
              data={filteredLanguages}
              keyExtractor={item => item}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.langRow,
                    { borderBottomColor: activeColors.border },
                    language === item && { backgroundColor: activeColors.backgroundSelected },
                  ]}
                  onPress={() => {
                    setLanguage(item);
                    setLangPickerVisible(false);
                    setSearchLangQuery('');
                  }}
                >
                  <Text
                    style={[
                      styles.langRowText,
                      { color: activeColors.text },
                      language === item && { fontWeight: '700', color: activeColors.primary },
                    ]}
                  >
                    {item.toUpperCase()}
                  </Text>
                  {language === item && <Check size={16} color={activeColors.primary} />}
                </TouchableOpacity>
              )}
            />
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
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: 60,
  },
  formGroup: {
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: Spacing.one,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickerTriggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    fontFamily: 'monospace',
    fontSize: 13,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addTagBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  removeTagBtn: {
    padding: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
    gap: Spacing.two,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    height: 40,
    marginBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
  },
  langRowText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
