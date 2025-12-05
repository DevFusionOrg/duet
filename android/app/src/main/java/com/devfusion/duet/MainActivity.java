package com.devfusion.duet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "duet_default_channel";
            String channelName = "Default Channel";
            String channelDesc = "General notifications for Duet";

            NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(channelId) == null) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    channelName,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(channelDesc);
                channel.setShowBadge(true);
                nm.createNotificationChannel(channel);
            }
        }

        try {
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
            FirebaseMessaging
                .getInstance()
                .getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.w("FCM_NATIVE", "getToken failed", task.getException());
                        return;
                    }
                    String token = task.getResult();
                    Log.i("FCM_NATIVE", "Native FCM token: " + token);
                });
        } catch (Exception e) {
            Log.e("FCM_NATIVE", "Error enabling FCM or fetching token", e);
        }
    }
}
