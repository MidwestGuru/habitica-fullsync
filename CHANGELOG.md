
## [1.8.0] - 2026-01-08
### Added
- Option to disable scoring tasks in Habitica (read-only sync mode).
- Option to disable creating new tasks in Habitica (only scores existing tasks).
- Configurable sync interval (minutes) for automatic sync.
### Changed
- Exclude tasks just scored from sync output.
- Updated settings UI for new options.
- Renamed from habitica-sync to habitica-fullsync in preperation for public release

## [1.7.0] - 2026-01-03
### Added
- Machine binding feature: restrict sync to a specific device using a hashed machine ID.
- New settings button to bind sync to the current machine.
- Current machine hash displayed in settings for transparency.# Changelog

## [1.6.3] - 2025-12-24
### Added
- Time zone-aware due dates for dailies and weekly tasks using local time.
### Changed
- Updated README to mention time zone handling.
- Version bump to 1.6.3.

## [1.6.2] - 2025-12-24
### Added
- Explicit tags for task types in Obsidian output:
  - Dailies tagged with #daily
  - Habits tagged with #habit
  - Rewards tagged with #reward
### Changed
- Updated README to reflect new tagging behavior.

## [1.6.1] - 2025-12-24
### Removed
- Habitica task link from Obsidian output for cleaner formatting.
### Changed
- Updated README to remove link and clarify notes placement.

## [1.6.0] - 2025-12-24
### Added
- Automatic Sync option:
  - Runs on plugin load and every 30 minutes.
- Folder selection setting for output file.
- Future start date handling for dailies and weekly tasks.
- Notes included in Markdown output (after text, before properties).
### Changed
- Improved error handling and performance.
- Markdown enhancements with summary section.

## [1.5.0] - Initial Release
### Features
- Sync Habitica tasks into Obsidian.
- Score completed tasks from vault (last 4 days).
- Support for group tasks.
- Rate-limited API calls with exponential backoff.