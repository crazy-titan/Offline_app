import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Search, Plus, List, LayoutGrid, Heart, Code, Tag, SlidersHorizontal, X } from 'lucide-react-native';
import { getAllSnippets, toggleFavorite, searchSnippets, getAllTags, getAllLanguages, Snippet } from '@/services/db';
import { getLayoutPreference, setLayoutPreference } from '@/services/preferences';
import { Colors, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');

  // Filter lists
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load data
  const loadData = useCallback(async (query: string = '', isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // 1. Get snippets
      let data: Snippet[] = [];
      if (query.trim()) {
        data = await searchSnippets(query);
      } else {
        data = await getAllSnippets();
      }

      // 2. Filter client-side if tag or language is selected
      if (selectedLanguage) {
        data = data.filter(s => s.language.toLowerCase() === selectedLanguage.toLowerCase());
      }
      if (selectedTag) {
        data = data.filter(s => s.tags.includes(selectedTag));
      }

      setSnippets(data);

      // 3. Load tags and languages
      const tags = await getAllTags();
      const langs = await getAllLanguages();
      setAvailableTags(tags);
      setAvailableLanguages(langs);

      // 4. Load layout preference
      const layout = await getLayoutPreference();
      setLayoutMode(layout);
    } catch (error) {
      console.error('Error loading snippets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTag, selectedLanguage]);

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadData(searchQuery);
    }, [loadData, searchQuery])
  );

  // Handle Search Input Change
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    loadData(text);
  };

  // Toggle layout mode
  const toggleLayout = async () => {
    const nextMode = layoutMode === 'list' ? 'grid' : 'list';
    setLayoutMode(nextMode);
    await setLayoutPreference(nextMode);
  };

  // Handle Favorite toggle
  const handleFavoriteToggle = async (id: number, currentStatus: boolean) => {
    await toggleFavorite(id, !currentStatus);
    // Locally update state to prevent full reload flash
    setSnippets(prev =>
      prev.map(s => (s.id === id ? { ...s, is_favorite: !currentStatus } : s))
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(searchQuery, true);
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedTag(null);
    setSelectedLanguage(null);
  };

  // Trigger reload when tag or language changes
  useEffect(() => {
    loadData(searchQuery);
  }, [selectedTag, selectedLanguage]);

  // Color helper for programming languages
  const getLanguageColor = (lang: string) => {
    const colorsMap: Record<string, string> = {
      javascript: '#F7DF1E',
      typescript: '#3178C6',
      tsx: '#3178C6',
      html: '#E34F26',
      css: '#1572B6',
      python: '#3776AB',
      sql: '#4479A1',
      json: '#000000',
    };
    return colorsMap[lang.toLowerCase()] || activeColors.accent;
  };

  const renderSnippetCard = ({ item }: { item: Snippet }) => {
    const isGrid = layoutMode === 'grid';
    return (
      <TouchableOpacity
        style={[
          styles.card,
          isGrid ? styles.gridCard : styles.listCard,
          {
            backgroundColor: activeColors.backgroundElement,
            borderColor: activeColors.border,
          },
        ]}
        onPress={() => router.push(`/snippet/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={[styles.cardTitle, { color: activeColors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.langBadge, { backgroundColor: getLanguageColor(item.language) + '20' }]}>
              <Text style={[styles.langText, { color: getLanguageColor(item.language) }]}>
                {item.language}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleFavoriteToggle(item.id, item.is_favorite)}
            style={styles.favButton}
          >
            <Heart
              size={18}
              color={item.is_favorite ? activeColors.danger : activeColors.textSecondary}
              fill={item.is_favorite ? activeColors.danger : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.codePreview, { color: activeColors.textSecondary }]} numberOfLines={isGrid ? 3 : 2}>
          {item.code.trim()}
        </Text>

        {item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, idx) => (
              <View key={idx} style={[styles.tagBadge, { backgroundColor: activeColors.backgroundSelected }]}>
                <Text style={[styles.tagText, { color: activeColors.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
            {item.tags.length > 3 && (
              <Text style={[styles.tagMore, { color: activeColors.textMuted }]}>+{item.tags.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Search and Layout Header */}
      <View style={[styles.searchBarContainer, { borderBottomColor: activeColors.border }]}>
        <View style={[styles.searchWrapper, { backgroundColor: activeColors.backgroundElement }]}>
          <Search size={18} color={activeColors.textSecondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search snippets, tags, languages..."
            placeholderTextColor={activeColors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            style={[styles.searchInput, { color: activeColors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearSearchIcon}>
              <X size={16} color={activeColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[
            styles.headerButton,
            { backgroundColor: showFilters ? activeColors.backgroundSelected : activeColors.backgroundElement },
          ]}
        >
          <SlidersHorizontal size={18} color={activeColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleLayout} style={[styles.headerButton, { backgroundColor: activeColors.backgroundElement }]}>
          {layoutMode === 'list' ? (
            <LayoutGrid size={18} color={activeColors.textSecondary} />
          ) : (
            <List size={18} color={activeColors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <View style={[styles.filtersPanel, { backgroundColor: activeColors.backgroundElement, borderBottomColor: activeColors.border }]}>
          {/* Languages Selector */}
          {availableLanguages.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={[styles.filterTitle, { color: activeColors.textMuted }]}>Languages</Text>
              <View style={styles.filterPills}>
                {availableLanguages.map(lang => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.filterPill,
                      selectedLanguage === lang
                        ? { backgroundColor: activeColors.primary }
                        : { backgroundColor: activeColors.backgroundSelected },
                    ]}
                    onPress={() => setSelectedLanguage(selectedLanguage === lang ? null : lang)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedLanguage === lang ? { color: '#fff' } : { color: activeColors.text },
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tags Selector */}
          {availableTags.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={[styles.filterTitle, { color: activeColors.textMuted }]}>Tags</Text>
              <View style={styles.filterPills}>
                {availableTags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.filterPill,
                      selectedTag === tag
                        ? { backgroundColor: activeColors.primary }
                        : { backgroundColor: activeColors.backgroundSelected },
                    ]}
                    onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedTag === tag ? { color: '#fff' } : { color: activeColors.text },
                      ]}
                    >
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {(selectedTag || selectedLanguage) && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
              <Text style={{ color: activeColors.danger, fontWeight: '600', fontSize: 12 }}>Clear Active Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main List */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={activeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={snippets}
          keyExtractor={item => item.id.toString()}
          key={layoutMode} // Force re-render when switching layout modes (list vs grid)
          numColumns={layoutMode === 'grid' ? 2 : 1}
          renderItem={renderSnippetCard}
          contentContainerStyle={[
            styles.listContent,
            snippets.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Code size={48} color={activeColors.textMuted} style={{ marginBottom: Spacing.two }} />
              <Text style={[styles.emptyTextTitle, { color: activeColors.text }]}>No Snippets Found</Text>
              <Text style={[styles.emptyTextSub, { color: activeColors.textSecondary }]}>
                {selectedTag || selectedLanguage || searchQuery
                  ? 'Try modifying your search query or filters.'
                  : 'Start by creating your first reusable snippet!'}
              </Text>
              {(selectedTag || selectedLanguage || searchQuery.length > 0) && (
                <TouchableOpacity
                  style={[styles.resetFiltersBtn, { backgroundColor: activeColors.primary }]}
                  onPress={() => {
                    clearFilters();
                    setSearchQuery('');
                    loadData('');
                  }}
                >
                  <Text style={styles.resetFiltersBtnText}>Reset Search & Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: activeColors.primary }]}
        onPress={() => router.push('/snippet/create')}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    gap: Spacing.one,
    borderBottomWidth: 1,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    height: 40,
  },
  searchIcon: {
    marginRight: Spacing.one,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchIcon: {
    padding: Spacing.one,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersPanel: {
    padding: Spacing.two,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  filterSection: {
    gap: Spacing.one,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  clearFiltersBtn: {
    alignSelf: 'flex-end',
    marginTop: Spacing.one,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.two,
    gap: Spacing.two,
    paddingBottom: 90, // safe space for FAB
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listCard: {
    width: '100%',
  },
  gridCard: {
    width: (screenWidth - Spacing.two * 3) / 2,
    marginHorizontal: Spacing.one / 2,
    marginVertical: Spacing.one / 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '90%',
  },
  langBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  langText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  favButton: {
    padding: 2,
  },
  codePreview: {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: Spacing.two,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tagBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  tagMore: {
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  emptyTextTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  emptyTextSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  resetFiltersBtn: {
    marginTop: Spacing.three,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetFiltersBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.three,
    right: Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
