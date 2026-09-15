# Taste
- Writes prompts in Vietnamese; keep replies and user-facing text (README, API messages, alerts) in Vietnamese. Confidence: 0.6
- Maintains project planning/spec docs (IDEA.md, PLAN.md, SKILL.md) and expects the agent to read those plus the existing code before starting to implement. Confidence: 0.5
- Wants backend capabilities exposed as clean REST API endpoints so a separate client app can integrate with them later, rather than embedding logic only in internal pipelines. Confidence: 0.5
- Prefers a plan-first workflow: before building a new app/feature, write a plan document and get it approved rather than jumping straight into code. Confidence: 0.55
- Wants system alerts delivered via Telegram. Confidence: 0.5
- Chose Expo + TypeScript (React Native) as the stack for the mobile client app. Confidence: 0.5
- Wants a single self-contained shell script (run.sh) to set up and run the whole project across Linux, macOS, and Windows, instead of separate per-OS scripts or manual multi-step instructions. Confidence: 0.55
