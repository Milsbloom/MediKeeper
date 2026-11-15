import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
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
import { refreshPlus } from '@/lib/plus';

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
  useReminders();
  useEffect(() => {
    // Check Plus status once at launch; it works offline from the saved status.
    void refreshPlus();
  }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="med/edit" options={{ presentation: 'modal', title: 'Medication' }} />
        <Stack.Screen name="profile/edit" options={{ presentation: 'modal', title: 'Person' }} />
        <Stack.Screen name="plus" options={{ presentation: 'modal', title: 'MediKeeper Plus' }} />
        <Stack.Screen
          name="welcome"
          options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
