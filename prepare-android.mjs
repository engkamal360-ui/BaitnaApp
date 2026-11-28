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
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
    </queries>`);
  fs.writeFileSync(mf, x);
}
console.log('android prepared');

// Fixed signing key (so every new build installs as an update over the old one) + growing version number.
const gradle = 'android/app/build.gradle';
let g = fs.readFileSync(gradle, 'utf8');
const run = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
g = g.replace(/versionCode \d+/, 'versionCode ' + (100 + run)).replace(/versionName "[^"]*"/, 'versionName "1.' + run + '"');
if (!g.includes('signingConfigs')) {
  g = g.replace('    buildTypes {', `    signingConfigs {
        family {
            storeFile file('../../baitna.keystore')
            storePassword 'baitna-family-2026'
            keyAlias 'baitna'
            keyPassword 'baitna-family-2026'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.family
        }`);
}
fs.writeFileSync(gradle, g);
console.log('signing + version set:', 100 + run);

// Native contact picker (one contact, once — no permanent contacts permission).
const pkg = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8')).appId;
const javaDir = 'android/app/src/main/java/' + pkg.replace(/\./g, '/');
fs.writeFileSync(javaDir + '/ContactPickerPlugin.java', `package ${pkg};

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ContactPicker")
public class ContactPickerPlugin extends Plugin {
    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, intent, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        String[] projection = { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER };
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(uri, projection, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                JSObject ret = new JSObject();
                ret.put("name", cursor.getString(0));
                ret.put("phone", cursor.getString(1));
                call.resolve(ret);
                return;
            }
            call.reject("not found");
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "error" : e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
        }
    }
}
`);
const mainAct = javaDir + '/MainActivity.java';
let ma = fs.readFileSync(mainAct, 'utf8');
if (!ma.includes('ContactPickerPlugin')) {
  ma = ma.replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ContactPickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}`);
  if (ma.includes('ContactPickerPlugin')) fs.writeFileSync(mainAct, ma);
  else { console.warn('WARNING: could not patch MainActivity; contact picker disabled'); fs.unlinkSync(javaDir + '/ContactPickerPlugin.java'); }
}
console.log('contact picker added');
