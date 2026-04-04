import notifee, {
  AndroidImportance,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── weeklyReview ──────────────────────────────────────────────────────────
// Schedules a repeating Friday 4pm notification for the GTD weekly review.

const PREF_KEY = '@allen_weekly_review';
const NOTIFICATION_ID = 'weekly-review';

export type WeeklyReviewPref = 'enabled' | 'declined';

export async function getWeeklyReviewPref(): Promise<WeeklyReviewPref | null> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) as WeeklyReviewPref | null;
  } catch {
    return null;
  }
}

/** Returns the Date of the next Friday at 4pm. */
function nextFriday4pm(): Date {
  const now = new Date();
  const result = new Date(now);
  // 5 = Friday
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
  result.setDate(now.getDate() + daysUntilFriday);
  result.setHours(16, 0, 0, 0);
  return result;
}

export async function enableWeeklyReview(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    if (!settings.authorizationStatus) return false;

    // Android requires a channel
    await notifee.createChannel({
      id: 'weekly-review',
      name: 'Weekly Review',
      importance: AndroidImportance.HIGH,
    });

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: nextFriday4pm().getTime(),
      repeatFrequency: RepeatFrequency.WEEKLY,
    };

    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: 'Time for your weekly review',
        body: 'Clear your head — process inbox, review projects, plan the week.',
        android: {channelId: 'weekly-review'},
      },
      trigger,
    );

    await AsyncStorage.setItem(PREF_KEY, 'enabled');
    return true;
  } catch (error) {
    console.error('Error enabling weekly review:', error);
    return false;
  }
}

export async function disableWeeklyReview(): Promise<void> {
  await notifee.cancelTriggerNotification(NOTIFICATION_ID);
  await AsyncStorage.setItem(PREF_KEY, 'declined');
}
