-- Undo of the initial migration: drops everything it created (data is lost, irreversible in production, see environments.md section 6).
DROP TABLE IF EXISTS invitations, registrations, slots, events, reset_tokens, users, login_attempts, club;
DROP TYPE IF EXISTS user_role;
