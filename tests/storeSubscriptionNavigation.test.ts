import assert from 'node:assert/strict';
import test from 'node:test';
import { isNativeAppContext, nativePlatform, nativeSubscriptionManagementUrl } from '../src/lib/nativeEnvironment.ts';

test('current Android and iOS user agents choose only their own subscription store', () => {
  for (const ua of ['Mozilla/5.0 (Linux; Android 16) Median/1.0', 'GoNativeAndroid/1.0']) {
    assert.equal(nativePlatform(ua), 'android');
    assert.equal(nativeSubscriptionManagementUrl(nativePlatform(ua)), 'https://play.google.com/store/account/subscriptions');
  }
  for (const [ua, touch] of [['MedianIOS/1.0', 0], ['Mozilla/5.0 (iPhone) Median/1.0', 1], ['Mozilla/5.0 (Macintosh) GoNative/1.0', 5]] as const) {
    assert.equal(nativePlatform(ua, touch), 'ios');
    assert.equal(nativeSubscriptionManagementUrl(nativePlatform(ua, touch)), 'https://apps.apple.com/account/subscriptions');
  }
});

test('native URL flags cannot select Apple for an unidentified platform', () => {
  const ua = 'Unknown wrapper';
  assert.equal(isNativeAppContext('?nativeApp=true', ua), true);
  assert.equal(nativePlatform(ua), null);
  assert.equal(nativeSubscriptionManagementUrl(nativePlatform(ua)), null);
  assert.equal(isNativeAppContext('', 'Mozilla Chrome'), false);
});

test('verified purchase store controls management across devices and web, without guessing unknown providers', () => {
  for (const platform of ['android', 'ios', null] as const) {
    assert.equal(nativeSubscriptionManagementUrl(platform, 'app_store'), 'https://apps.apple.com/account/subscriptions');
    assert.equal(nativeSubscriptionManagementUrl(platform, 'play_store'), 'https://play.google.com/store/account/subscriptions');
    assert.equal(nativeSubscriptionManagementUrl(platform, 'stripe'), null);
    assert.equal(nativeSubscriptionManagementUrl(platform, 'unknown'), null);
  }
});
