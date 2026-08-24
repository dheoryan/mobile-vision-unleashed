# MEUTUALS app structure

This is the runtime screen map for the current product. It records which UI
owns each asynchronous loading state so new data queries do not reintroduce
page-level spinners or layout jumps.

## Authenticated app shell (`/`)

The root mounts exactly one primary destination at a time. The bottom
navigation remains the stable wayfinding layer after profile bootstrap.

```text
App bootstrap
├─ age verification (when required)
├─ onboarding (when no profile exists)
└─ authenticated shell
   ├─ Timeline
   │  ├─ Tribe feed
   │  ├─ Global feed
   │  └─ Composer / post comments
   ├─ Discover
   │  ├─ Tribe previews
   │  ├─ ranked Explore deck
   │  └─ searchable people list
   ├─ Ventures
   │  ├─ Looking: open Venture board
   │  ├─ Yours: accepted/applied Ventures
   │  └─ Hosting: Active / History
   ├─ Chats
   │  ├─ Tribe room → full-screen Tribe view
   │  ├─ Venture party rooms → message panel
   │  └─ Direct threads → message panel
   └─ Profile
      ├─ Posts
      ├─ Saved posts
      ├─ Hosted Ventures
      ├─ Edit profile
      └─ Settings / Options
         ├─ account and password
         ├─ notifications
         ├─ nearby discovery
         ├─ safety, legal, and support
         ├─ blocked accounts
         └─ account actions
```

## Standalone routes

- Auth: `/login`, `/signup`, `/reset-password`
- Activity: `/notifications`, `/p/$postId`, `/u/$handle`
- Policy: `/terms`, `/privacy`, `/community-guidelines`
- Feature-flagged monetization/host surfaces: `/tiers`, `/upgrade`, `/host`,
  `/host-dashboard`
- Staff-only moderation: `/admin/reports`

## Loading ownership

All reusable loading layouts live in
`src/components/mutuals/Skeleton.tsx`. The shell bootstrap, feed cards, people,
Venture thumbnails, conversation rows, compact Profile lists, notifications,
and message bubbles each preserve the geometry of their final content. The
screen or nested panel that starts a query owns its matching skeleton; the app
shell does not hide already-available navigation while one destination loads.

Static policy and form routes do not need skeletons because they do not wait on
remote content. Empty and error states remain explicit and are not replaced by
skeletons.
