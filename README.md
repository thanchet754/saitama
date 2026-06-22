# Saitama Workout - PWA Fitness Tracker

A Progressive Web App (PWA) that counts exercise repetitions and tracks workout duration using mobile browser motion sensors and GPS geolocation. Designed with a vibrant dark-mode fitness aesthetic, it supports bilingual localization (Vietnamese and English) and automatically synchronizes workout sessions to a Supabase backend.

## Features

- **Automatic Rep Counting**: Leverages browser `DeviceMotionEvent` (accelerometer magnitude calculation with low-pass filters) to count repetitions for Squats, Crunches, Push-ups, and Pull-ups.
- **GPS Running Tracker**: Uses `navigator.geolocation` to monitor running distance, speed, and average pace.
- **Offline First**: Utilizes LocalStorage for offline data caching and Service Worker (`sw.js`) for instant loading without network.
- **Supabase Auto-Sync**: Instantly pushes completed workouts and daily targets to Supabase tables when network is connected.
- **Daily Goals**: Setup daily exercise targets manually or trigger the ultimate **Saitama Challenge** (100 squats, 100 crunches, 100 push-ups, 10km run, 50 pull-ups, and 5-min plank).
- **Personal Records (PR)**: Tracks your highest achievements across all exercise types.
- **Vibrant Chart**: Dynamic HTML5 Canvas bar chart summarizing weekly calories burned.

## Files

- `index.html` - App interface markup and templates.
- `index.css` - Custom styling tokens, layouts, and animations.
- `app.js` - Sensors processor, local storage caching, translation keys, and Supabase integration.
- `manifest.json` - PWA configuration.
- `sw.js` - Offline caching logic.

## Supabase Database Setup

Create the following tables in your Supabase SQL editor:

```sql
-- 1. Workout Sessions Table
create table workout_sessions (
  id bigint generated always as identity primary key,
  exercise_type text not null,
  start_time bigint not null,
  end_time bigint not null,
  duration_seconds bigint not null,
  rep_count integer not null,
  calories_burned float4 not null,
  distance_km float4,
  user_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Daily Goals Table
create table daily_goals (
  id bigint generated always as identity primary key,
  date_string text not null,
  exercise_type text not null,
  target_value integer not null,
  user_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## Deployment

Since it is a pure static web app, you can easily host it on Vercel, Netlify, or GitHub Pages. Just drag and drop the folder or link your repository to deploy instantly.
