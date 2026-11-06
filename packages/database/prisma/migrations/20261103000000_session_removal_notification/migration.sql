-- Someone an operator removes from a Session hears about it; Club removal keeps MEMBERSHIP_REMOVED.
ALTER TYPE "NotificationEvent" ADD VALUE 'SESSION_PARTICIPANT_REMOVED' AFTER 'SESSION_CANCELLED';
