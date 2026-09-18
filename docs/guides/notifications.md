# Daily Notifications

Chrondle offers optional daily reminders to help you maintain your streak.

## Features

- **Customizable Time:** set your preferred notification time (default: 9:00 AM)
- **Browser Notifications:** native browser push notifications on desktop and mobile
- **Service Worker Support:** notifications work even when the app isn't open
- **Smart Permission Flow:** a two-step process that explains benefits before requesting permission
- **Visual Feedback:** the bell icon shows notification status at a glance

## Setting Up Notifications

1. Click the **bell icon** in the top navigation bar
2. Toggle notifications on and select your preferred time
3. Click "Enable Notifications" to see the benefits
4. Grant permission when prompted by your browser
5. You'll receive a daily reminder at your chosen time

## Notification States

- **🔔 Bell icon (filled):** notifications enabled and active
- **🔔 Bell icon (outline):** notifications available but not enabled
- **🔕 Bell with slash:** notifications blocked by browser settings

## Troubleshooting

- **Not receiving notifications?** Check your browser's notification settings.
- **Mobile issues?** Ensure the site is added to your home screen for best results.
- **Changed your mind?** You can disable notifications anytime from the bell menu.

## Architecture

- **Service Worker:** background script handles push notifications.
- **Permission Management:** graceful handling of permission states.
- **Persistence:** user preferences saved to both localStorage and Convex.
- **Cross-Device Sync:** authenticated users' settings sync across devices.

Notification scheduling respects each player's local calendar day — see
[Daily Day Semantics](../../README.md#daily-day-semantics) and
[DST Handling](../development/DST_HANDLING_RESEARCH.md) for how "today" and
timezone edge cases are resolved.
