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

## Still Needs Production Verification

- real Android/iOS dev build with Firebase files and app identifiers;
- push delivery from backend workers in a production-like environment;
- audio/video calls on two physical devices with TURN configured;
- large media upload limits with real backend storage settings;
- backend-enforced group removal visibility verified with two real accounts.
