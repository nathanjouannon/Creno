-- F-22, ADR-0016: registration mode of an event (RG-19) and free slots (RG-20), additive only.
-- Existing events take the default FIXED and existing registrations keep their slot: no data is rewritten.

CREATE TYPE registration_mode AS ENUM ('FIXED', 'FREE', 'BOTH');

ALTER TABLE events
    ADD COLUMN registration_mode registration_mode NOT NULL DEFAULT 'FIXED';

-- A registration is either on a fixed slot (slot_id only) or a free slot (event_id, starts_at, ends_at, at least
-- 30 minutes, RG-20), never a mix. UNIQUE (slot_id, user_id) is kept: NULLs never compare equal.
ALTER TABLE registrations
    ALTER COLUMN slot_id DROP NOT NULL,
    ADD COLUMN event_id  INTEGER REFERENCES events (id) ON DELETE CASCADE,
    ADD COLUMN starts_at TIMESTAMPTZ,
    ADD COLUMN ends_at   TIMESTAMPTZ,
    ADD CONSTRAINT registrations_kind_check CHECK (
        (slot_id IS NOT NULL AND event_id IS NULL AND starts_at IS NULL AND ends_at IS NULL)
        OR
        (slot_id IS NULL AND event_id IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL
            AND ends_at >= starts_at + INTERVAL '30 minutes')
    );

-- Free slots of an event (event page, overlap check of RG-20)
CREATE INDEX registrations_event_id_idx ON registrations (event_id) WHERE event_id IS NOT NULL;
