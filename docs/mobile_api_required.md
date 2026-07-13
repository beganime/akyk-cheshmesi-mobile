# Mobile API Status

The mobile client is aligned with the backend contract documented in
`../akyl-chesmesi/docs/mobile_api.md`. Backend code is treated as read-only from
this repository.

## Environment

- API base URL: configured in `src/config/env.ts` through Expo env values.
- WebSocket URL: configured by `EXPO_PUBLIC_WS_URL`.
- Calls WebSocket URL: configured by `EXPO_PUBLIC_CALL_WS_URL`.
- Android FCM file for this Expo project: `./google-services.json`.
- iOS Firebase file: `./GoogleService-Info.plist`.

## Auth/Profile

Used endpoints:

- `POST /api/auth/register/`
- `POST /api/auth/verify-email/`
- `POST /api/auth/set-password/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/users/me/`
- profile update/avatar upload endpoints from the backend mobile docs.

Mobile behavior:

- access and refresh tokens are stored locally;
- 401 responses trigger refresh and retry;
- registration verifies email first and requires a phone number before entering the app;
- after `set-password`, mobile binds `phone_number` through authenticated
  `PATCH /api/users/me/` because the signup endpoint does not accept phone fields;
- logout unregisters the known push token before clearing the session.

## Push

Used endpoints:

- `POST /api/push-tokens/`
- `DELETE /api/push-tokens/`
- alias fallback: `/api/device-tokens/`

Payload sent by mobile:

```json
{
  "token": "...",
  "provider": "fcm|apns",
  "platform": "android|ios|web",
  "device_id": "...",
  "device_name": "...",
  "app_version": "...",
  "meta": {}
}
```

Handled notification data types:

- `message`
- `call`
- `missed_call`
- `story_reply`
- `story_reaction`

Navigation uses `chat_uuid`, `message_uuid`, `call_uuid`, and `story_uuid` when
present.

## Chats/Groups/Messages

Used endpoints:

- `GET /api/chats/`
- `POST /api/chats/` for direct and group chats
- `GET/PATCH/DELETE /api/chats/{chat_uuid}/`
- `POST /api/chats/{chat_uuid}/members/`
- `DELETE /api/chats/{chat_uuid}/members/{user_uuid}/`
- `POST /api/chats/{chat_uuid}/admins/`
- `DELETE /api/chats/{chat_uuid}/admins/{user_uuid}/`
- `POST /api/chats/{chat_uuid}/leave/`
- message list/send/edit/delete/read receipt endpoints from mobile docs.

Mobile screens:

- chat list and chat detail;
- group member management;
- owner/admin/member-aware action UI;
- optimistic send and retry for text/media messages.

## Media

Used endpoints:

- preferred: `POST /api/media/upload-local/`
- fallback when backend requests direct upload:
  - `POST /api/media/presign/`
  - signed `PUT`
  - `POST /api/media/complete/`
- `GET /api/media/{media_uuid}/`
- `DELETE /api/media/{media_uuid}/`

Mobile never builds `/media/...` paths manually. Rendering uses `file_url` and
`thumbnail_url` from backend responses, which are signed URLs.

Supported media flows:

- image;
- video;
- audio voice message with duration and optional waveform;
- video note;
- document/file.

## Stories

Used endpoints:

- `GET /api/stories/`
- `POST /api/stories/`
- `GET /api/stories/{story_uuid}/`
- `DELETE /api/stories/{story_uuid}/`
- `POST /api/stories/{story_uuid}/viewers/`
- `POST /api/stories/{story_uuid}/reply/`
- `POST /api/stories/{story_uuid}/react/`

When reply/reaction returns `chat_uuid`, mobile opens the direct chat context.

Story media publishing uses the same media pipeline as chat attachments:

1. upload image/video through `POST /api/media/upload-local/` or the presigned
   upload fallback;
2. create the story with `media_type=image|video` and `media_uuid`.

## Calls

Used endpoints/events:

- `POST /api/chats/{chat_uuid}/calls/`
- `POST /api/calls/{call_uuid}/accept/`
- `POST /api/calls/{call_uuid}/decline/`
- fallback alias: `POST /api/calls/{call_uuid}/reject/`
- `POST /api/calls/{call_uuid}/cancel/`
- `POST /api/calls/{call_uuid}/end/`
- `POST /api/calls/{call_uuid}/missed/`
- REST signaling fallback: `POST /api/calls/{call_uuid}/signals/`
- WebSocket: `join_call`, `leave_call`, `call:invite`, `call:accept`,
  `call:decline`, `call:end`, `call:missed`, `call:offer`, `call:answer`,
  `call:ice-candidate`;
- compatibility events: `call_offer`, `call_answer`, `call_ice`,
  `call_invite`.

Mobile has native WebRTC integration through `react-native-webrtc`. Production
quality still depends on real device builds, TURN/STUN credentials, and FCM/APNS
credentials.

The mobile create/action payload now follows the backend contract:

```json
{
  "call_type": "audio",
  "metadata": {
    "device_id": "local-device-id",
    "device_platform": "android|ios|web",
    "device_name": "Akyl Cheshmesi Mobile",
    "notify_offline": true,
    "create_even_if_offline": true
  }
}
```

REST signaling fallback sends `signal_type` (`offer`, `answer`,
`ice-candidate`) with the SDP/candidate inside `payload`.

## Bots

Used endpoints:

- `GET /api/bots/`
- `POST /api/bots/`
- `GET/PATCH/DELETE /api/bots/{bot_uuid}/`
- `POST /api/bots/{bot_uuid}/rotate-token/`
- `GET /api/chats/{chat_uuid}/bots/`
- `POST /api/chats/{chat_uuid}/bots/`
- `DELETE /api/chats/{chat_uuid}/bots/{bot_uuid}/`
- `POST /api/bots/send-message/` with `Authorization: Bot <token>`.

Mobile screens:

- bot list;
- create bot and show one-time token;
- bot detail/update/delete/rotate token;
- add/remove bot in chat;
- test send message as bot by pasted token.

## Local UX and Cache

Implemented locally in the mobile client:

- profile is now a focused account screen;
- settings are split into dedicated screens: language, bots, devices, storage,
  notifications, chat settings, appearance, privacy, security;
- language screen shows Russian as the default language;
- six app themes are available: Editorial light/dark, Amber light/dark, and
  Lagoon light/dark;
- the default visual system follows the warm editorial reference: parchment
  background, paper surfaces, wine primary actions, violet links, and lagoon
  secondary accents;
- first-time chat senders are shown in chats only until the user adds them to
  contacts;
- device contacts are loaded locally through `expo-contacts`; the address book
  is not uploaded to the server;
- local contact add/remove, muted chats, hidden chats, and hidden users are
  persisted in AsyncStorage;
- chat list cache is shown first and refreshed from the server;
- avatars, story previews, chat media, stickers, and profile images use the
  Expo image memory/disk cache;
- storage settings can clear JSON cache, image cache, or all app cache.

## External News API

The news tab reads the public Student's Life API directly:

- primary: `https://students-life.ru/api2/api/v1/news/`;
- fallback: `https://stud-life.com/api/v1/news/`;
- list filters: `search`, `category`, `category__slug`, `is_important`, and
  `ordering`;
- category and article detail routes support both numeric IDs and slugs.

The mobile client falls back to the original host on network errors, `404`, or
server errors from the proxy.

Native Android/iOS requests are not subject to browser CORS. The external news
hosts currently allow the local web origin `http://localhost:8081`, but do not
return `Access-Control-Allow-Origin` for `https://akyl-cheshmesi.ru`. Before a
production web deployment, that origin must be allowlisted by the news service
or exposed through an Akyl Cheshmesi same-origin backend proxy.

## Backend APIs Still Needed

These flows are prepared in the mobile UI, but still need backend endpoints if
they should sync across devices and survive reinstall:

- contacts:
  - stop automatically creating `UserContact` records from every chat;
  - `GET /api/users/contacts/` must return only explicitly saved contacts;
  - `POST /api/users/contacts/` with `user_uuid`;
  - `DELETE /api/users/contacts/{user_uuid}/`;
  - `POST /api/users/contacts/discover/` accepting normalized phone hashes and
    returning matched users without exposing non-matching phone numbers;
- registration phone enforcement:
  - optional preferred change: accept `phone_number` in
    `POST /api/auth/set-password/` and validate uniqueness/format atomically;
  - current mobile fallback uses `PATCH /api/users/me/` immediately after
    signup, so the flow works but the backend does not enforce atomic binding;
- real block/unblock users:
  - `POST /api/users/{user_uuid}/block/`
  - `DELETE /api/users/{user_uuid}/block/`
  - blocked users must not be able to message or call the current user;
- per-chat and per-user notification preferences:
  - mute/unmute chat;
  - hide/unhide chat;
  - list muted chats/users;
- device/session management:
  - `GET /api/devices/`
  - `DELETE /api/devices/{device_id}/`
  - current session marker and last active timestamps;
- synced settings:
  - appearance/theme preferences;
  - chat settings;
  - notification settings;
  - privacy settings;
- security settings:
  - change password;
  - 2FA setup/disable;
  - active session revoke;
- optional storage/account stats:
  - media usage by type;
  - server-side cache/storage cleanup if backend stores user-owned media quotas.
- story archive/history:
  - `GET /api/v1/stories/mine/?include_expired=true` (or an equivalent route);
  - return the authenticated user's active and expired stories with media,
    viewer counts, creation time, and expiration time;
  - the current `GET /api/v1/stories/` only supports the active 24-hour feed,
    so the profile can currently show active own stories but not a permanent
    archive.

## Still Needs Production Verification

- real Android/iOS dev build with Firebase files and app identifiers;
- push delivery from backend workers in a production-like environment;
- audio/video calls on two physical devices with TURN configured;
- offline/background call delivery using backend push tokens and
  `type=call`/`type=missed_call` payloads;
- large media upload limits with real backend storage settings;
- backend-enforced group removal visibility verified with two real accounts.
