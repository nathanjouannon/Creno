-- Undo of free slots and registration modes: the free slots are deleted (they cannot exist without a slot) and every
-- event goes back to fixed slots. Irreversible in production once free slots are used (environments.md, section 6).
DELETE FROM registrations WHERE slot_id IS NULL;
DROP INDEX registrations_event_id_idx;
ALTER TABLE registrations
    DROP CONSTRAINT registrations_kind_check,
    DROP COLUMN ends_at,
    DROP COLUMN starts_at,
    DROP COLUMN event_id,
    ALTER COLUMN slot_id SET NOT NULL;
ALTER TABLE events DROP COLUMN registration_mode;
DROP TYPE registration_mode;
