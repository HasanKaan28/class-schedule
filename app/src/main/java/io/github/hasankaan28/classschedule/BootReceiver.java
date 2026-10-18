package io.github.hasankaan28.classschedule;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android drops alarms on reboot, app update and clock changes; this arms the saved reminders again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Reminders.scheduleAll(context);
    }
}
