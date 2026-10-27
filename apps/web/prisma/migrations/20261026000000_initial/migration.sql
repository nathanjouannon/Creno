-- Initial migration: docs/domain/schema.sql, verbatim structure (ADR-0015).

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

CREATE TABLE club (
    id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name        TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
    timezone    TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    identifier_hash  TEXT        NOT NULL UNIQUE,
    failed_count     INTEGER     NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    locked_until     TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    last_name           TEXT        NOT NULL CHECK (length(btrim(last_name)) > 0),
    first_name          TEXT        NOT NULL CHECK (length(btrim(first_name)) > 0),
    email               TEXT        NOT NULL,
    password_hash       TEXT        NOT NULL,
    role                user_role   NOT NULL DEFAULT 'USER',
    token_version       INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE reset_tokens (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reset_tokens_user_id_idx ON reset_tokens (user_id);

CREATE TABLE events (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        TEXT        NOT NULL CHECK (length(btrim(title)) > 0),
    description  TEXT,
    location     TEXT,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX events_ends_at_idx ON events (ends_at);

CREATE TABLE slots (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    INTEGER     NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    capacity    INTEGER     CHECK (capacity >= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX slots_event_id_idx ON slots (event_id);

CREATE TABLE registrations (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slot_id     INTEGER     NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
    user_id     INTEGER     REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slot_id, user_id)
);

CREATE INDEX registrations_user_id_idx ON registrations (user_id);

CREATE TABLE invitations (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    INTEGER     NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invitations_event_id_idx ON invitations (event_id);
