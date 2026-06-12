/**
 * Per-platform GPX import instructions (SPEC §2: Strava's API cannot create
 * routes — GPX export + manual import is the canonical loop).
 */
export interface PlatformGuide {
  id: string;
  name: string;
  note?: string;
  steps: string[];
}

export const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: 'strava',
    name: 'Strava',
    note: 'Route import on Strava requires a subscription and is web-only.',
    steps: [
      'Open strava.com → Maps → My Routes (web, not the app).',
      'Click "Create New Route", then the upload icon → "Upload GPX file".',
      'Pick your ghost-tracks GPX — Strava snaps it to its own basemap.',
      'Save the route; it syncs to the Strava mobile app for navigation.',
      'No subscription? Record with Garmin/Komoot navigation instead — the recorded activity still draws the art on Strava.'
    ]
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    steps: [
      'Open connect.garmin.com → Training & Planning → Courses.',
      'Choose "Import" and drop in the GPX file.',
      'Set course type to Running and save.',
      'Send to your watch via "Send to Device" — turn-by-turn included.'
    ]
  },
  {
    id: 'komoot',
    name: 'Komoot',
    steps: [
      'Open komoot.com/upload (or the app\'s "Import file").',
      'Drop in the GPX and choose "Plan a Tour" from it.',
      'Komoot re-snaps the line to its network — review the overlay.',
      'Save the Tour and start navigation from your phone or watch.'
    ]
  }
];
