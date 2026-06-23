---
name: xinzi-product-soul
description: Xinzi product strategy, brand voice, feature direction, and decision principles. Use when planning or implementing Xinzi features, editing UI copy or product tone, designing fishing-at-work gameplay, prioritizing roadmap ideas, preparing README or release notes, or refactoring toward iOS, Android, watchOS, and shared core architecture.
---

# Xinzi Product Soul

## Product Position

Treat Xinzi as a worker-companion product, not a plain salary calculator. Its durable promise is:

> Make salary, time, off-work hope, and fishing-at-work humor visible in a small daily companion.

The product combines three layers:

- **Useful core**: Accurate work-time, salary, lunch, off-work, holiday, and transfer-workday calculation.
- **Emotional value**: Make users feel seen inside ordinary workdays through playful wording and tiny rituals.
- **Shareable personality**: Turn fishing time, boss-loss money, and workday summaries into moments people want to screenshot.

## Current Product Truth

When changing the app, preserve these current pillars:

- macOS menu bar is the primary surface; desktop window is the richer settings and history surface.
- The app calculates today earned, worked time, remaining time, lunch pause, off-work state, holidays, and transfer-workdays.
- Fishing salary is an independent fun statistic; it must not corrupt real salary calculation.
- Privacy hiding is important because users may screenshot money-related UI.
- publicHoliday API plus cache and manual overrides currently handle China holiday/workday judgment.
- GitHub README and Releases are the current public distribution channel.

## Voice And Design

Use a cute, hand-drawn, slightly absurd worker tone. The app should feel mischievous but still trustworthy.

- Prefer playful Chinese copy with a working-person perspective: `今日已赚`, `累计窝囊费`, `摸鱼`, `老板痛失`, `不要工作了`.
- Keep humor short and UI-native. Do not turn screens into long explanations.
- Avoid cold HR-tool language unless the user explicitly requests a formal mode.
- Keep important salary and time numbers scannable before jokes.
- Preserve the small-black hand-drawn visual direction when adding new UI.

## Roadmap Principles

Prioritize by this rule:

1. **Retention first**: Salary, time, holiday, and settings must be stable and fast.
2. **Personality second**: Fishing gameplay and worker humor make the product memorable.
3. **Shareability third**: Reports, titles, summaries, and funny stats should become screenshot-worthy.
4. **Architecture always**: New logic should move toward shared core modules that can later serve iOS, Android, and watchOS.

Good future directions include:

- Daily work report: worked time, earned money, fishing time, and boss-loss summary.
- Fishing titles or personas based on session length and weekly habits.
- Boss-loss leaderboard across today, week, month, and all time.
- Off-work countdown copy that changes with remaining time.
- Salary-to-life-unit conversion, such as milk tea, meals, rent fragments, or gadgets.
- Weekly/monthly wrapped-style reports.
- Desktop widget or sticker with small-black emotional states.
- Watch/iOS/Android companions for glanceable earnings, countdown, and one-tap fishing.
- Special copy for holiday transfer-workdays and forced weekend work.

## Architecture Direction

Plan implementation so the current Electron app can become one client of a broader product.

- Extract salary calculation, day-type judgment, fishing session logic, review rules, and privacy masking into platform-neutral core modules.
- Keep Electron-specific code focused on tray, windows, IPC, local file paths, and packaging.
- Keep storage schemas explicit and migration-friendly because mobile and watch clients may need sync later.
- Keep copy/rules configurable where possible; the product tone will evolve quickly.
- For any new feature, identify whether it belongs to shared core, macOS shell, renderer UI, or release/distribution.

## Decision Checklist

Before finalizing a Xinzi change, check:

- Does the change preserve salary accuracy and not confuse real earnings with fishing earnings?
- Does it make the menu bar or popover more useful without becoming noisy?
- Does the copy feel like Xinzi: playful, concise, and worker-native?
- Does it keep privacy-sensitive values hideable when screenshots are likely?
- Does it avoid locking future iOS, Android, and watchOS versions into Electron-only assumptions?
