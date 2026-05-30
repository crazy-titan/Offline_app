import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '@/services/db';
import { initFileSystem } from '@/services/files';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'light' ? 'light' : 'dark'; // default to dark theme
  const activeColors = Colors[scheme];

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepareApp() {
      try {
        // Initialize local SQLite database
        await initDatabase();
        // Initialize sandboxed file system folders
        await initFileSystem();
      } catch (error) {
        console.error('Failed to initialize database or filesystem:', error);
      } finally {
        setIsReady(true);
      }
    }
    prepareApp();
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: activeColors.background }]}>
        <ActivityIndicator size="large" color={activeColors.primary} />
      </View>
    );
  }

  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    dark: scheme === 'dark',
    colors: {
      ...baseTheme.colors,
      primary: activeColors.primary,
      background: activeColors.background,
      card: activeColors.backgroundElement,
      text: activeColors.text,
      border: activeColors.border,
      notification: activeColors.accent,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="snippet/[id]" 
            options={{ 
              headerShown: true, 
              title: 'Snippet Details',
              headerStyle: { backgroundColor: activeColors.backgroundElement },
              headerTintColor: activeColors.text,
              headerShadowVisible: false,
            }} 
          />
          <Stack.Screen 
            name="snippet/create" 
            options={{ 
              headerShown: true, 
              title: 'Editor',
              headerStyle: { backgroundColor: activeColors.backgroundElement },
              headerTintColor: activeColors.text,
              headerShadowVisible: false,
            }} 
          />
          <Stack.Screen 
            name="file-viewer" 
            options={{ 
              headerShown: true, 
              title: 'File Viewer',
              headerStyle: { backgroundColor: activeColors.backgroundElement },
              headerTintColor: activeColors.text,
              headerShadowVisible: false,
            }} 
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
