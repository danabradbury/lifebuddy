## Kiosk hardware setup (draft)

This is a working note for how to turn a cheap device into a Lifebuddy doorway screen.

### Device options

- **Tablet** (Android or iPad)
  - Pros: simple, integrated screen, touch, battery backup.
  - Cons: browser kiosk mode can be a bit fiddly.
- **Raspberry Pi + monitor**
  - Pros: flexible, easy to script, can add sensors (motion, camera).
  - Cons: a bit more hardware setup.

### Browser kiosk mode (high level)

Regardless of device:

- Configure OS to auto-login to a user account.
- Auto-start a browser in full-screen kiosk mode pointing to:
  - `http://<your-frontend-host>/kiosk`
- Disable sleep/screensaver or set them to match your preferences.

Concrete scripts and config will be added here once we pick a specific device.

