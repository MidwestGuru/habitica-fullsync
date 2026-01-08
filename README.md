# Habitica Fyll Sync Plugin for Obsidian

Sync your Habitica tasks with your Obsidian vault! This plugin lets you view, score, and manage Habitica tasks directly from Obsidian, with advanced options for automation, device binding, and granular control over sync behavior.

---

## Features

- **Sync Habitica tasks into Obsidian:**  
  Pulls your personal and group tasks from Habitica and formats them in Markdown for easy review and tracking.

- **Score completed tasks from your vault:**  
  Automatically scores Habitica tasks that you’ve marked as completed in Obsidian (with support for last 4 days).

- **Support for group tasks:**  
  Syncs tasks from your Habitica party or guild.

- **Rate-limited API calls:**  
  Handles Habitica API rate limits gracefully with exponential backoff.

- **Configurable automatic sync interval:**  
  Set how often the plugin syncs with Habitica (in minutes).

- **Disable scoring option:**  
  Enable read-only sync mode to prevent scoring tasks in Habitica.

- **Disable creating new tasks option:**  
  Prevents the plugin from creating new Habitica tasks for completed vault tasks that don’t already exist in Habitica.

- **Folder selection for output file:**  
  Choose where the `habitica-sync.md` file is saved in your vault.

- **Machine binding:**  
  Restrict sync to a specific device using a hashed machine ID. Useful for multi-device setups.

- **Platform-aware auto-sync:**  
  Choose whether auto-sync runs on desktop, mobile, or both.

- **Time zone–aware due dates:**  
  Dailies and weekly tasks use your local time for due dates.

- **Explicit tags for task types:**  
  Dailies, habits, and rewards are tagged in the Markdown output.

- **Notes included in Markdown output:**  
  Task notes are shown after the task text.

- **Summary section in Markdown output:**  
  Each sync includes a summary of the number of tasks synced.

---

## Installation

1. Download or clone the plugin files into your Obsidian plugins folder.
2. Enable the plugin in Obsidian’s settings.
3. Enter your Habitica API credentials and configure options as desired.

---

## Settings

| Setting                       | Description                                                                                  |
|-------------------------------|----------------------------------------------------------------------------------------------|
| **API User**                  | Your Habitica API User ID.                                                                   |
| **API Token**                 | Your Habitica API Token (stored in plain text; do not share your vault).                     |
| **Group ID**                  | Your Habitica Group ID (Party or Guild).                                                     |
| **Output Folder**             | Folder where `habitica-fullsync.md` will be saved (leave blank for vault root).                  |
| **Automatic Sync**            | Enable automatic sync on load and every X minutes.                                           |
| **Sync Interval (minutes)**   | How often to run auto-sync when enabled.                                                     |
| **Auto Sync Platform**        | Choose which devices should run auto sync (desktop, mobile, or both).                        |
| **Disable Scoring**           | Enable this to prevent scoring tasks in Habitica (read-only sync).                           |
| **Disable Creating New Tasks**| Enable this to prevent creating new tasks in Habitica (only scores existing tasks).          |
| **Machine Binding**           | Bind sync to this machine only (see machine ID in settings).                                 |

---

## Usage

- **Manual Sync:**  
  Use the command palette (`Ctrl+P`) and select “Sync Habitica Tasks” to run a sync manually.

- **Automatic Sync:**  
  If enabled, sync runs on plugin load and at the interval you specify.

- **Scoring Tasks:**  
  When scoring is enabled, completed tasks in your vault (marked `- [x] ...`) will be scored in Habitica if they have a Habitica ID.  
  If a completed vault task does not have a Habitica ID and creating is enabled, a new Habitica task will be created and scored.

- **Read-Only Mode:**  
  Enable “Disable Scoring” to prevent any scoring actions in Habitica.  
  Enable “Disable Creating New Tasks” to prevent new Habitica tasks from being created for completed vault tasks.

- **Machine Binding:**  
  Bind sync to your current device to prevent other devices from syncing your Habitica tasks.

---

## Markdown Output

- Tasks are grouped by type (Dailies, To-Dos, Rewards, Habits) and by source (Personal, Group).
- Each task includes:
  - Completion status (`[x]` for completed, `[ ]` for incomplete)
  - Task text and notes
  - Tags for type and Habitica tags
  - Priority
  - Due date (if applicable)
  - Habitica task ID
  - Completion date (for completed tasks)

Example:

```markdown
### Dailies
#### Personal Tasks
- [ ] Drink Water #daily [id:: abc123] [priority:: medium] [due:: 2026-01-09]
#### Group Tasks
_No tasks found._
```

---

## Advanced

- **Rate Limiting:**  
  The plugin automatically handles Habitica API rate limits. If you hit the limit, sync will retry after a delay.

- **Error Handling:**  
  Errors are logged to the console and surfaced in Obsidian notices.

- **Customization:**  
  All sync and scoring behaviors can be customized via the settings tab.

---

## Security

- **API Token:**  
  Your Habitica API token is stored in plain text in your vault. Do not share your vault with others.

- **Machine Binding:**  
  Machine binding uses a locally generated UUID to restrict sync to a specific device.

---

## Changelog

See `CHANGELOG.md` for a full history of features, changes, and fixes.

---

## License

MIT

---

If you need further customization or want to contribute, please open an issue or pull request!
