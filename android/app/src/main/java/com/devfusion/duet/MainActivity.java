package com.devfusion.duet;

import android.os.Bundle;
import android.view.WindowManager;
import android.media.AudioManager;
import android.content.Context;
import android.graphics.Color;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Keep screen on during audio playback
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        
        // Set audio to music stream for proper background handling
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        
        // Request audio focus for music playback
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }

        WebView webView = getBridge().getWebView();
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        webView.setBackgroundColor(Color.TRANSPARENT);
    }
    
    @Override
    public void onPause() {
        super.onPause();
        // Don't clear the keep screen on flag when paused
        // This allows audio to continue in background
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Re-request audio focus when resuming
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            audioManager.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }
}
