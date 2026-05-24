import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { nightlyAnalysis } from './nightly-analysis';
export { onCheckinWrite } from './on-checkin-write';
export { alertsMonitor } from './alerts-monitor';
export { dataExportPurge } from './data-export-purge';
export { smartNotificationsCron } from './smart-notifications-cron';
export { tdeeRecalcWeekly } from './tdee-recalc-weekly';
export { wearableSyncNightly } from './wearable-sync-nightly';
export { stripeWebhook } from './stripe-webhook';
export { stripeEventsCleanup } from './stripe-events-cleanup';
export { offBaseIngestion } from './off-base-ingestion';
export { streakRiskMarker } from './streak-risk-marker';
