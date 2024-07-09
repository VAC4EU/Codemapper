
ALTER TABLE mrhier ADD column ptra varchar(9)[];
UPDATE mrhier SET ptra = string_to_array(ptr, '.');

CREATE EXTENSION pg_trgm;
CREATE INDEX mrconso_ix_cui ON mrconso(cui);
CREATE INDEX mrconso_ix_sab ON mrconso(sab);
CREATE INDEX mrconso_ix_tty ON mrconso(tty);
CREATE INDEX mrconso_ix_str ON mrconso(str);
CREATE INDEX mrconso_ix_code ON mrconso(code);
CREATE INDEX mrconso_ix_aui ON mrconso(aui);
CREATE INDEX mrconso_ix_str_gin ON mrconso USING GIN (str gin_trgm_ops);
CREATE INDEX mrconso_ix_code_gin ON mrconso USING GIN (code gin_trgm_ops);
CREATE INDEX mrhier_sab ON mrhier(sab);
CREATE INDEX mrhier_aui ON mrhier(aui);
CREATE INDEX mrhier_paui ON mrhier(paui);
CREATE INDEX mrhier_ptra ON mrhier USING GIN(ptra);
CREATE INDEX mrsty_ix_cui ON mrsty(cui);
CREATE INDEX mrsab_ix_curver ON mrsab(curver);
CREATE INDEX mrdef_ix_cui ON mrdef(cui);
CREATE INDEX mrcui_ix_cui1 ON mrcui(cui1);
VACUUM ANALYZE;

-- Extract mrhier(sab,aui,ptr) into a table (sab,aui,ppaui) The result has
-- 351_141_782 records and takes 14GB without index even when using integers for
-- aui and ppaui

-- -- create enum type `sab` with all possible values of sab in mrconso
-- DROP TYPE IF EXISTS sab;
-- DO $$
-- BEGIN EXECUTE (
-- SELECT format(
--   'CREATE TYPE sab AS ENUM (%s)',
--   string_agg(DISTINCT quote_literal(sab), ', ')
-- ) FROM mrconso
-- );
-- END $$;

-- SELECT enum_range(NULL::sab);

-- DROP TABLE IF EXISTS mrppaui;
-- CREATE TABLE mrppaui (
--     sab sab not null,
--     cui integer not null,
--     aui integer not null,
--     ppaui integer not null
-- );

-- INSERT INTO mrppaui( sab, cui, aui, ppaui)
-- SELECT
--     sab::sab,
--     to_number(substring(cui from 2), '99999999') as cui,
--     to_number(substring(aui from 2), '99999999') as aui,
--     to_number(substring(unnest(string_to_array(ptr, '.')) from 2), '99999999') as ppaui
-- FROM mrhier LIMIT 1000;

-- CREATE INDEX mrpptr_sab ON mrpptr(sab);
-- CREATE INDEX mrpptr_aui ON mrpptr(aui);
-- CREATE INDEX mrpptr_ppaui ON mrpptr(ppaui);
