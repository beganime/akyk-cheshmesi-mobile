# Mobile API Required

The mobile client now uses the prepared chat, group, story, call, media, presence, and profile APIs from `docs/mobile_api.md`.

UI exists for these settings, but no dedicated backend endpoints are documented yet:

- account security sessions and device management;
- chat privacy controls beyond local mute/pin/archive preferences;
- language preference sync;
- storage usage analytics and cache cleanup sync;
- notification category preferences beyond push token registration;
- documented push token registration/removal endpoint:
  - `POST /api/push-tokens/` or `POST /api/device-tokens/`
  - payload: `{ "token": "...", "provider": "fcm|apns", "platform": "android|ios", "device_id": "...", "device_name": "...", "app_version": "..." }`
  - `DELETE /api/push-tokens/` or equivalent for logout/device removal;
  - server-side push dispatch for new messages, incoming calls, missed calls, and story replies;
  - push data must include `chat_uuid` and optional `message_uuid`/`call_uuid` so notification taps open the right screen;
- story text replies/reactions as first-class story endpoints.

Until those endpoints exist, the app explains unavailable actions in-place and keeps local-only preferences on the device.
