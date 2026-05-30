import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { Home, Heart, FolderOpen, Settings } from 'lucide-react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark';
  const activeColors = Colors[scheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColors.primary,
        tabBarInactiveTintColor: activeColors.textSecondary,
        tabBarStyle: {
          backgroundColor: activeColors.backgroundElement,
          borderTopColor: activeColors.border,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: activeColors.backgroundElement,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: activeColors.border,
        },
        headerTintColor: activeColors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Snippets',
          tabBarLabel: 'Snippets',
          headerTitle: 'Code Snippets',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarLabel: 'Favorites',
          headerTitle: 'Favorite Snippets',
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="file-manager"
        options={{
          title: 'Files',
          tabBarLabel: 'Files',
          headerTitle: 'File Explorer',
          tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          headerTitle: 'Configuration',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
