# Privacy Policy

**Last updated: March 1, 2026**

This privacy policy describes how crab.ac ("we", "us") collects, uses, and protects your information when you use our platform at [app.crab.ac](https://app.crab.ac).

## Information We Collect

### Account Data
When you create an account, we collect:
- **Email address** — used for login, verification, and password resets
- **Username and display name** — publicly visible identifiers
- **Password** — stored as a bcrypt hash (12 rounds); we never store plaintext passwords

### Profile Data
You may optionally provide:
- **Avatar image** — uploaded and stored on our servers
- **Branding colors** — custom profile accent colors
- **Online status** — visible to other users in your spaces

### Content
Anything you post on the platform is stored on our servers, including:
- Messages and direct messages
- Forum posts and replies
- Media gallery uploads
- Blog posts
- Calendar events

### Social Data
We store records of your social interactions:
- Friend connections and follow relationships
- Mute and block lists (visible only to you)

### Newsletter Data
If you subscribe to newsletters:
- **Authenticated users**: your subscription is linked to your account
- **Anonymous subscribers**: we store only your email address
- **Tracking**: we track email opens and link clicks using hashed IP addresses (SHA-256), not raw IPs. You can disable tracking via the `newsletter_tracking_enabled` toggle in your settings
- **Digests**: if you opt in, we send daily or weekly digests

### Push Notifications
If you enable push notifications, we store your device token (iOS/Android) to deliver notifications. Tokens are removed when you disable notifications or log out.

### Authentication Tokens
- **Access tokens (JWT)**: stored in your browser's localStorage; short-lived
- **Refresh tokens**: stored as SHA-256 hashes on our servers; expire after 30 days
- **MFA secrets**: encrypted with AES before storage if you enable two-factor authentication
- **Verification tokens**: expire after 24 hours
- **MFA challenges**: expire after 5 minutes

## How We Use Your Information

We use your information solely to operate the platform:
- Authenticate you and maintain your session
- Deliver messages, notifications, and newsletters
- Display your profile to other users
- Enforce mutes, blocks, and permissions

## Third-Party Services

We use a limited number of third-party services:
- **Amazon SES** — for sending transactional and newsletter emails
- **Apple Push Notification service (APNs)** — for iOS push notifications

We do **not** use any analytics services, advertising networks, or tracking pixels. We do **not** sell, rent, or share your data with third parties.

## Your Rights

You can:
- **Update or delete** your profile information at any time through the app
- **Disable newsletter tracking** via your account settings
- **Unsubscribe** from any newsletter with one click
- **Request account deletion** by contacting us — we will delete your account and associated data

## Cookies

We do **not** use cookies. Authentication is handled entirely via JWT tokens stored in localStorage.

## Changes to This Policy

We may update this policy from time to time. Changes will be posted on this page with an updated date.

## Contact

If you have questions about this policy, contact us at [bingo@crab.ac](mailto:bingo@crab.ac).
