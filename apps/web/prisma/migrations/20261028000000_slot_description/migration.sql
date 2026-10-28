-- F-21, RG-07: optional plain-text description of a slot, 500 characters at most; NULL = none (blank is stored as NULL by the service).
ALTER TABLE slots
    ADD COLUMN description TEXT,
    ADD CONSTRAINT slots_description_check
        CHECK (description IS NULL OR (length(btrim(description)) > 0 AND char_length(description) <= 500));
