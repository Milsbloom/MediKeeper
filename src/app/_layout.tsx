import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

import {
  handleNotificationResponse,
  onNotificationResponse,
  setupReminders,
  syncReminders,
  takeLaunchResponse,
  type NotificationResponse,
} from '@/lib/reminders';
import { Colors, fontFor } from '@/constants/theme';
import { refreshPlus } from '@/lib/plus';

// Keep the splash up until the fonts are ready, so text never jumps from one font to another.
SplashScreen.preventAutoHideAsync().catch(() => {});

function useReminders() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    const onResponse = async (r: NotificationResponse) => {
      const handledByButton = await handleNotificationResponse(r);
      if (!handledByButton && !cancelled) router.navigate('/');
    };

    (async () => {
      await setupReminders();
      await syncReminders();
      // The app may have been opened by tapping a reminder while it was closed.
      const last = await takeLaunchResponse();
      if (last && !cancelled) await onResponse(last);
    })();

    const unsubscribeResponses = onNotificationResponse((r) => {
      void onResponse(r);
    });
    // Top up the schedule whenever the app comes back to the foreground.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders();
    });

    return () => {
      cancelled = true;
      unsubscribeResponses();
      appStateSub.remove();
    };
  }, []);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useReminders();
  useEffect(() => {
    // Check Plus status once at launch; it works offline from the saved status.
    void refreshPlus();
  }, []);
  if (!ready) return null;

  const dark = colorScheme === 'dark';
  const c = Colors[dark ? 'dark' : 'light'];
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.tint, background: c.background, card: c.background, text: c.text, border: c.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.background },
          headerTitleStyle: { fontFamily: fontFor('600'), color: c.text },
          headerTintColor: c.tint,
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="med/edit" options={{ presentation: 'modal', title: 'Medication' }} />
        <Stack.Screen name="profile/edit" options={{ presentation: 'modal', title: 'Person' }} />
        <Stack.Screen name="plus" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen
          name="welcome"
          options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
