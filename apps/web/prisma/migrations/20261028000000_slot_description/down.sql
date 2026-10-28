-- Undo of the slot description: drops the column and its text (the descriptions are lost, irreversible in production
-- once used, see environments.md section 6).
ALTER TABLE slots DROP CONSTRAINT slots_description_check, DROP COLUMN description;
