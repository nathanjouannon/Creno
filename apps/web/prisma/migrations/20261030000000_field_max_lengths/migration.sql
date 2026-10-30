-- RG-01, RG-06, RG-17 (#79): longest accepted texts, the same figures as the shared Zod schemas. char_length counts
-- characters, so the database is never stricter than the schemas (which count UTF-16 units).
ALTER TABLE club
    ADD CONSTRAINT club_name_length_check CHECK (char_length(name) <= 120);

ALTER TABLE users
    ADD CONSTRAINT users_first_name_length_check CHECK (char_length(first_name) <= 50),
    ADD CONSTRAINT users_last_name_length_check CHECK (char_length(last_name) <= 50),
    ADD CONSTRAINT users_email_length_check CHECK (char_length(email) <= 254);

ALTER TABLE events
    ADD CONSTRAINT events_title_length_check CHECK (char_length(title) <= 100),
    ADD CONSTRAINT events_location_length_check CHECK (location IS NULL OR char_length(location) <= 200),
    ADD CONSTRAINT events_description_length_check CHECK (description IS NULL OR char_length(description) <= 2000);
