-- Local sessions are the only supported identity mechanism.
ALTER TABLE users DROP COLUMN firebase_uid;
