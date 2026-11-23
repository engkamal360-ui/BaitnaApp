// Applies Baitna's icons, splash and permissions to the generated Capacitor Android project.
import fs from 'fs';
const mf = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(mf, 'utf8');
if (!x.includes('USE_BIOMETRIC')) {
  x = x.replace('<uses-permission android:name="android.permission.INTERNET" />', `<uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>`);
  fs.writeFileSync(mf, x);
}
console.log('android prepared');
