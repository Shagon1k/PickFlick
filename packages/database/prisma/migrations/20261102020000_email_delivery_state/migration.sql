-- NotificationEmailDelivery keeps the attempt count, first attempt and last reason; every attempt
-- is also in the worker's structured log. Nothing read the per-attempt rows or the request hash.
DROP TABLE "NotificationDeliveryAttempt";
DROP TYPE "NotificationChannel";
ALTER TABLE "NotificationEmailDelivery" DROP COLUMN "requestHash";
