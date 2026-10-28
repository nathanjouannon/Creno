-- Schéma initial de Créno, généré depuis erd.mmd.
-- Dialecte : PostgreSQL (le SGBD définitif sera fixé par un ADR en phase 6 ; les types utilisés ont un équivalent partout).
-- Uniquement des CREATE. Les noms de tables sont au pluriel (« user » est un mot réservé) ; les noms de colonnes en snake_case.
-- La convention de casse définitive sera fixée dans docs/conventions.md.
-- États calculés (upcoming, ongoing, past, started, remainingPlaces, full, empty) : jamais stockés.

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

-- Club (RG-16, RG-17). Une seule ligne, créée par la page d'installation avec le premier administrateur.
CREATE TABLE club (
    id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- une seule ligne possible
    name        TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
    timezone    TEXT        NOT NULL,  -- fuseau horaire IANA de l'instance, ex. 'Europe/Paris'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Échecs de connexion par adresse saisie, que l'adresse ait un compte ou non (RG-03).
-- Pas de clé étrangère. identifier_hash = empreinte de l'e-mail normalisé, jamais l'adresse en clair.
-- Les lignes sans blocage et anciennes sont purgées régulièrement.
CREATE TABLE login_attempts (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    identifier_hash  TEXT        NOT NULL UNIQUE,
    failed_count     INTEGER     NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    locked_until     TIMESTAMPTZ,  -- NULL = non bloqué
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Utilisateur (RG-01, RG-04). La suppression d'un compte supprime la ligne entière (RG-11).
CREATE TABLE users (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    last_name           TEXT        NOT NULL CHECK (length(btrim(last_name)) > 0),
    first_name          TEXT        NOT NULL CHECK (length(btrim(first_name)) > 0),
    email               TEXT        NOT NULL,
    password_hash       TEXT        NOT NULL,  -- le mot de passe en clair fait au moins 10 caractères (RG-01), vérifié avant hachage
    role                user_role   NOT NULL DEFAULT 'USER',
    token_version       INTEGER     NOT NULL DEFAULT 0,  -- augmente à la réinitialisation du mot de passe : invalide les jetons JWT (RG-12)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E-mail unique sans tenir compte de la casse (RG-01).
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Jeton de réinitialisation de mot de passe (RG-12). Le jeton est stocké haché.
CREATE TABLE reset_tokens (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,          -- création + 3 jours
    used_at     TIMESTAMPTZ,                   -- NULL tant que non utilisé
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reset_tokens_user_id_idx ON reset_tokens (user_id);

-- Événement (RG-06). Seul le titre est obligatoire dans le formulaire ; description et lieu sont facultatifs.
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

CREATE INDEX events_ends_at_idx ON events (ends_at);  -- masquer les événements passés (RG-09)

-- Créneau (RG-07). capacity NULL = places illimitées.
-- Règle non exprimable ici : capacity >= nombre d'inscriptions existantes (vérifié par le service).
CREATE TABLE slots (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    INTEGER     NOT NULL REFERENCES events (id) ON DELETE CASCADE,  -- RG-10
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    capacity    INTEGER     CHECK (capacity >= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX slots_event_id_idx ON slots (event_id);

-- Inscription (RG-07, RG-08, RG-11). user_id NULL = « ancien membre ».
-- Les inscriptions futures d'un compte supprimé sont supprimées par le service avant la suppression du compte.
CREATE TABLE registrations (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slot_id     INTEGER     NOT NULL REFERENCES slots (id) ON DELETE CASCADE,  -- RG-10
    user_id     INTEGER     REFERENCES users (id) ON DELETE SET NULL,          -- RG-11
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slot_id, user_id)  -- une seule inscription par utilisateur et créneau (RG-08) ; les NULL ne se comparent pas
);

CREATE INDEX registrations_user_id_idx ON registrations (user_id);

-- Invitation (RG-02). Lien réutilisable ; la validité est calculée : valide tant que now() < events.starts_at.
-- `token` contient l'empreinte SHA-256 du jeton (hexadécimal), jamais le jeton lui-même (security.md).
CREATE TABLE invitations (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    INTEGER     NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invitations_event_id_idx ON invitations (event_id);
