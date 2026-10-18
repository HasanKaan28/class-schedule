package io.github.hasankaan28.classschedule;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Weekly notifications built by the web app: each entry is {day: 1-7 (Mon-Sun), min: minutes after midnight,
 * title, body}. The page sends the whole list whenever the timetable, the language or the settings change;
 * every alarm re-arms itself for the next week after it fires.
 */
final class Reminders {
    static final String CHANNEL_ID = "classes";
    private static final String PREFS = "reminders";
    private static final String KEY_LIST = "list";
    private static final String KEY_SCHEDULED = "scheduled";
    private static final String EXTRA_INDEX = "index";
    private static final int NOTIFICATION_BASE = 1000;

    private Reminders() {
    }

    static void save(Context context, String json) {
        prefs(context).edit().putString(KEY_LIST, json).apply();
        scheduleAll(context);
    }

    static void scheduleAll(Context context) {
        SharedPreferences prefs = prefs(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        int previous = prefs.getInt(KEY_SCHEDULED, 0);
        for (int i = 0; i < previous; i++) {
            alarms.cancel(alarmIntent(context, i));
        }
        JSONArray list = list(prefs);
        long now = System.currentTimeMillis();
        for (int i = 0; i < list.length(); i++) {
            JSONObject entry = list.optJSONObject(i);
            if (entry != null) {
                arm(context, alarms, i, nextTime(entry, now));
            }
        }
        prefs.edit().putInt(KEY_SCHEDULED, list.length()).apply();
    }

    /** Called by ReminderReceiver when an alarm goes off. */
    static void fire(Context context, Intent intent) {
        int index = intent.getIntExtra(EXTRA_INDEX, -1);
        JSONObject entry = list(prefs(context)).optJSONObject(index);
        if (entry == null) {
            return;
        }
        post(context, index, entry.optString("title"), entry.optString("body"));
        // A minute ahead, so a slightly early alarm does not land on today again.
        arm(context, context.getSystemService(AlarmManager.class), index, nextTime(entry, System.currentTimeMillis() + 60_000));
    }

    static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, context.getString(R.string.channel_name), NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(context.getString(R.string.channel_description));
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private static void post(Context context, int index, String title, String body) {
        createChannel(context);
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_class)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build();
        try {
            context.getSystemService(NotificationManager.class).notify(NOTIFICATION_BASE + index, notification);
        } catch (SecurityException ignored) {
            // Notifications are blocked for the app; the settings screen tells the student how to allow them.
        }
    }

    private static void arm(Context context, AlarmManager alarms, int index, long at) {
        PendingIntent intent = alarmIntent(context, index);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        }
    }

    private static PendingIntent alarmIntent(Context context, int index) {
        Intent intent = new Intent(context, ReminderReceiver.class).putExtra(EXTRA_INDEX, index);
        return PendingIntent.getBroadcast(
                context, index, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Next moment after {@code after} that falls on the entry's weekday and time. */
    private static long nextTime(JSONObject entry, long after) {
        int day = entry.optInt("day", 1);
        int minutes = entry.optInt("min", 0);
        Calendar at = Calendar.getInstance();
        at.setTimeInMillis(after);
        at.set(Calendar.HOUR_OF_DAY, minutes / 60);
        at.set(Calendar.MINUTE, minutes % 60);
        at.set(Calendar.SECOND, 0);
        at.set(Calendar.MILLISECOND, 0);
        int target = day % 7 + 1; // 1 = Monday ... 7 = Sunday  ->  Calendar.MONDAY ... Calendar.SUNDAY
        at.add(Calendar.DAY_OF_MONTH, (target - at.get(Calendar.DAY_OF_WEEK) + 7) % 7);
        if (at.getTimeInMillis() <= after) {
            at.add(Calendar.DAY_OF_MONTH, 7);
        }
        return at.getTimeInMillis();
    }

    private static JSONArray list(SharedPreferences prefs) {
        try {
            return new JSONArray(prefs.getString(KEY_LIST, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
