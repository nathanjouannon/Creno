-- Undo of the maximum lengths: drops the constraints only, no data is lost.
ALTER TABLE events
    DROP CONSTRAINT events_description_length_check,
    DROP CONSTRAINT events_location_length_check,
    DROP CONSTRAINT events_title_length_check;

ALTER TABLE users
    DROP CONSTRAINT users_email_length_check,
    DROP CONSTRAINT users_last_name_length_check,
    DROP CONSTRAINT users_first_name_length_check;

ALTER TABLE club
    DROP CONSTRAINT club_name_length_check;
