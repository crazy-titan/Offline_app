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
import { Search, Heart, Code, List, LayoutGrid, X } from 'lucide-react-native';
import { getFavoriteSnippets, toggleFavorite, Snippet } from '@/services/db';
import { getLayoutPreference, setLayoutPreference } from '@/services/preferences';
import { Colors, Spacing } from '@/constants/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');

  // Load data
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getFavoriteSnippets();
      setSnippets(data);
      applySearch(searchQuery, data);

      const layout = await getLayoutPreference();
      setLayoutMode(layout);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  // Apply search filtering locally
  const applySearch = (query: string, rawData: Snippet[]) => {
    if (!query.trim()) {
      setFilteredSnippets(rawData);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = rawData.filter(
      s =>
        s.title.toLowerCase().includes(lower) ||
        s.code.toLowerCase().includes(lower) ||
        s.language.toLowerCase().includes(lower) ||
        s.tags.some(tag => tag.toLowerCase().includes(lower))
    );
    setFilteredSnippets(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applySearch(text, snippets);
  };

  const toggleLayout = async () => {
    const nextMode = layoutMode === 'list' ? 'grid' : 'list';
    setLayoutMode(nextMode);
    await setLayoutPreference(nextMode);
  };

  const handleFavoriteToggle = async (id: number) => {
    await toggleFavorite(id, false); // unfavorite
    // Locally remove or update
    setSnippets(prev => prev.filter(s => s.id !== id));
    setFilteredSnippets(prev => prev.filter(s => s.id !== id));
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

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
            onPress={() => handleFavoriteToggle(item.id)}
            style={styles.favButton}
          >
            <Heart size={18} color={activeColors.danger} fill={activeColors.danger} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.codePreview, { color: activeColors.textSecondary }]} numberOfLines={isGrid ? 3 : 2}>
          {item.code.trim()}
        </Text>

        {item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map((tag, idx) => (
              <View key={idx} style={[styles.tagBadge, { backgroundColor: activeColors.backgroundSelected }]}>
                <Text style={[styles.tagText, { color: activeColors.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
            {item.tags.length > 2 && (
              <Text style={[styles.tagMore, { color: activeColors.textMuted }]}>+{item.tags.length - 2}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Search Header */}
      <View style={[styles.searchBarContainer, { borderBottomColor: activeColors.border }]}>
        <View style={[styles.searchWrapper, { backgroundColor: activeColors.backgroundElement }]}>
          <Search size={18} color={activeColors.textSecondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search favorites..."
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
        <TouchableOpacity onPress={toggleLayout} style={[styles.headerButton, { backgroundColor: activeColors.backgroundElement }]}>
          {layoutMode === 'list' ? (
            <LayoutGrid size={18} color={activeColors.textSecondary} />
          ) : (
            <List size={18} color={activeColors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={activeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSnippets}
          keyExtractor={item => item.id.toString()}
          key={layoutMode}
          numColumns={layoutMode === 'grid' ? 2 : 1}
          renderItem={renderSnippetCard}
          contentContainerStyle={[
            styles.listContent,
            filteredSnippets.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Heart size={48} color={activeColors.textMuted} style={{ marginBottom: Spacing.two }} />
              <Text style={[styles.emptyTextTitle, { color: activeColors.text }]}>No Favorites Yet</Text>
              <Text style={[styles.emptyTextSub, { color: activeColors.textSecondary }]}>
                {searchQuery
                  ? 'No results match your search query.'
                  : 'Star snippets to add them to this list for quick access.'}
              </Text>
            </View>
          }
        />
      )}
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.two,
    gap: Spacing.two,
    paddingBottom: 40,
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
});
