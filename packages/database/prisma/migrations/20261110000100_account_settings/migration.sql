CREATE TABLE "AccountAvatarObject" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountAvatarObject_createdAt_idx" ON "AccountAvatarObject"("createdAt");
ALTER TABLE "User"
    ADD COLUMN "avatarObjectKey" TEXT,
    ADD COLUMN "isAvatarRemoved" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "appearance" JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "User_avatarObjectKey_key" ON "User"("avatarObjectKey");
ALTER TABLE "User" ADD CONSTRAINT "User_avatarObjectKey_fkey"
    FOREIGN KEY ("avatarObjectKey") REFERENCES "AccountAvatarObject"("key")
    ON DELETE SET NULL ON UPDATE CASCADE;
