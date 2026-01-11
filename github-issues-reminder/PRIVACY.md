# Privacy Policy for GitHub Issue Reminder

**Last Updated:** January 12, 2026

## Overview

GitHub Issue Reminder is a browser extension that notifies you when new issues are created in GitHub repositories you choose to track. We are committed to protecting your privacy.

## Data Collection

### What We Collect
- **Repository names**: The names of GitHub repositories you choose to track (e.g., "facebook/react")
- **Timestamps**: When repositories were last checked for new issues

### What We Don't Collect
- Personal information (name, email, etc.)
- GitHub credentials or tokens
- Browsing history
- Any data from websites you visit

## Data Storage

All data is stored **locally on your device** using Chrome's built-in storage APIs:
- `chrome.storage.sync` - Stores your list of tracked repositories (synced across your Chrome browsers if signed in)
- `chrome.storage.local` - Stores timestamps for polling

**No data is ever sent to our servers** because we don't have any servers. The extension only communicates with GitHub's public API to fetch issue information.

## Third-Party Services

This extension uses the **GitHub REST API** to fetch public issue data. When you track a repository, the extension makes requests to:
- `https://api.github.com/repos/{owner}/{repo}/issues`

Please refer to [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) for information on how GitHub handles API requests.

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | To save your list of tracked repositories |
| `notifications` | To show desktop notifications for new issues |
| `alarms` | To periodically check for new issues |
| `https://api.github.com/*` | To fetch issue data from GitHub's API |

## Data Sharing

We do **not** share, sell, or transfer your data to any third parties.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Your Rights

You can:
- View all stored data via Chrome's developer tools
- Delete all data by removing the extension
- Remove individual repositories through the extension popup
