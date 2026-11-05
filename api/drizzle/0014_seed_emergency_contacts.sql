INSERT INTO "angoleva"."emergency_contacts" ("id", "label", "phone_number") VALUES
('emc-police', 'Polícia Nacional', '113'),
('emc-ambulance', 'Ambulância (INEMA)', '112'),
('emc-angoleva', 'AngoLeva — apoio', '955161704')
ON CONFLICT ("id") DO NOTHING;
