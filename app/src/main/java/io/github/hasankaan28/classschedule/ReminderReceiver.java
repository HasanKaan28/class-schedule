package io.github.hasankaan28.classschedule;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Posts a class reminder when its alarm goes off and arms the same reminder for next week. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Reminders.fire(context, intent);
    }
}
