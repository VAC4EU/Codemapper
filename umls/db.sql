grant usage on schema public to codemapper;

grant select on all tables in schema public to codemapper;

-- from https://www.nlm.nih.gov/research/umls/implementation_resources/community/dbloadscripts/pgsql_all_tables_sql.zip

-- sed 's|@TABLES@|/path/to/umls/YEAR/TABLES|' umls-tables.sql|psql umlsYEAR

DROP TABLE IF EXISTS MRCONSO;
CREATE TABLE MRCONSO (
	CUI	char(8) NOT NULL,
	LAT	char(3) NOT NULL,
	TS	char(1) NOT NULL,
	LUI	char(9) NOT NULL,
	STT	varchar(3) NOT NULL,
	SUI	char(9) NOT NULL,
	ISPREF	char(1) NOT NULL,
	AUI	varchar(9) NOT NULL,
	SAUI	varchar(50),
	SCUI	varchar(100),
	SDUI	varchar(50),
	SAB	varchar(20) NOT NULL,
	TTY	varchar(20) NOT NULL,
	CODE	varchar(100) NOT NULL,
	STR	text NOT NULL,
	SRL	int NOT NULL,
	SUPPRESS char(1) NOT NULL,
	CVF	int,
	dummy	char(1)
);
COPY MRCONSO from '@TABLES@/MRCONSO.RRF' with delimiter as '|' null as '';
ALTER TABLE mrconso DROP COLUMN dummy;

DROP TABLE IF EXISTS MRDEF;
CREATE TABLE MRDEF (
	CUI	char(8) NOT NULL,
	AUI	varchar(9) NOT NULL,
	ATUI	varchar(11) NOT NULL,
	SATUI	varchar(50),
	SAB	varchar(20) NOT NULL,
	DEF	text NOT NULL,
	SUPPRESS	char(1) NOT NULL,
	CVF	int,
	dummy char(1)
);
COPY MRDEF from '@TABLES@/MRDEF.RRF' with delimiter as '|' null as '';
alter table mrdef drop column dummy;

DROP TABLE IF EXISTS MRHIER;
CREATE TABLE MRHIER (
	CUI	char(8) NOT NULL,
	AUI	varchar(9) NOT NULL,
	CXN	int NOT NULL,
	PAUI	varchar(9),
	SAB	varchar(20) NOT NULL,
	RELA	varchar(100),
	PTR	text,
	HCD	varchar(51),
	CVF	int,
	dummy char(1)
);
COPY MRHIER from '@TABLES@/MRHIER.RRF' with delimiter as '|' null as '';
ALTER TABLE mrhier DROP COLUMN dummy;

DROP TABLE IF EXISTS MRSAB;
CREATE TABLE MRSAB (
	VCUI	char(8),
	RCUI	char(8),
	VSAB	varchar(24) NOT NULL,
	RSAB	varchar(20) NOT NULL,
	SON	text NOT NULL,
	SF	varchar(20) NOT NULL,
	SVER	varchar(20),
	VSTART	char(10),
	VEND	char(10),
	IMETA	varchar(10) NOT NULL,
	RMETA	varchar(10),
	SLC	text,
	SCC	text,
	SRL	int NOT NULL,
	TFR	int,
	CFR	int,
	CXTY	varchar(50),
	TTYL	varchar(200),
	ATNL	text,
	LAT	char(3),
	CENC	varchar(20) NOT NULL,
	CURVER	char(1) NOT NULL,
	SABIN	char(1) NOT NULL,
	SSN	text NOT NULL,
	SCIT	text NOT NULL,
	dummy char(1)
);
COPY MRSAB from '@TABLES@/MRSAB.RRF' with delimiter as '|' null as '';
alter table mrsab drop column dummy;

DROP TABLE IF EXISTS MRSTY;
CREATE TABLE MRSTY (
	CUI	char(8) NOT NULL,
	TUI	char(4) NOT NULL,
	STN	varchar(100) NOT NULL,
	STY	varchar(50) NOT NULL,
	ATUI	varchar(11) NOT NULL,
	CVF	int,
	dummy char(1)
);
COPY MRSTY from '@TABLES@/MRSTY.RRF' with delimiter as '|' null as '';
alter table mrsty drop column dummy;

DROP TABLE IF EXISTS MRCUI;
CREATE TABLE MRCUI (
	CUI1	char(8) NOT NULL,
	VER	varchar(10) NOT NULL,
	REL	varchar(4) NOT NULL,
	RELA	varchar(100),
	MAPREASON	text,
	CUI2	char(8),
	MAPIN	char(1),
	dummy char(1)
);
copy MRCUI from '@TABLES@/MRCUI.RRF' with delimiter as '|' null as '';
alter table mrcui drop column dummy;

-- returns a table of codes that are children of the given codes
drop function if exists related_children;
create function related_children (sab varchar, code varchar, lat varchar)
returns table (sab varchar, code varchar, str varchar)
as $$
  select distinct m2.sab, m2.code, m2.str
  from mrconso m1
  inner join mrhier h on h.paui = m1.aui
  inner join mrconso m2 on m2.cui = h.cui
  where m1.sab = related_children.sab
  and m1.code = related_children.code
  and m2.lat = related_children.lat
  and m2.suppress != 'Y'
  order by m2.sab, m2.code
$$ language sql;

drop view if exists mrconso_preferred;
create view mrconso_preferred
as
  select cui,aui,sab,tty,code,str,suppress
  from mrconso
  where ts = 'P'
  and stt = 'PF'
  and ispref = 'Y'
  and lat = 'ENG';

ALTER TABLE mrhier ADD column ptra varchar(9)[];
UPDATE mrhier SET ptra = string_to_array(ptr, '.');

CREATE EXTENSION pg_trgm;
CREATE INDEX mrconso_ix_aui ON mrconso(aui);
CREATE INDEX mrconso_ix_code ON mrconso(code);
CREATE INDEX mrconso_ix_code_gin ON mrconso USING GIN (code gin_trgm_ops);
CREATE INDEX mrconso_ix_cui ON mrconso(cui);
CREATE INDEX mrconso_ix_sab ON mrconso(sab);
CREATE INDEX mrconso_ix_str ON mrconso(str);
CREATE INDEX mrconso_ix_str_gin ON mrconso USING GIN (str gin_trgm_ops);
CREATE INDEX mrconso_ix_tty ON mrconso(tty);
CREATE INDEX mrcui_ix_cui1 ON mrcui(cui1);
CREATE INDEX mrdef_ix_cui ON mrdef(cui);
CREATE INDEX mrhier_aui ON mrhier(aui);
CREATE INDEX mrhier_paui ON mrhier(paui);
CREATE INDEX mrhier_ptra ON mrhier USING GIN(ptra);
CREATE INDEX mrhier_rela ON mrhier(rela);
CREATE INDEX mrhier_sab ON mrhier(sab);
CREATE INDEX mrsab_ix_curver ON mrsab(curver);
CREATE INDEX mrsty_ix_cui ON mrsty(cui);
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
