
-- from https://www.nlm.nih.gov/research/umls/implementation_resources/community/dbloadscripts/pgsql_all_tables_sql.zip

-- sed 's|@META@|/path/to/umls/YEAR/META|' umls-tables.sql|psql umlsYEAR

DROP TABLE MRCONSO;
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
COPY MRCONSO from '@META@/MRCONSO.RRF' with delimiter as '|' null as '';
alter table mrconso drop column dummy;

DROP TABLE MRDEF;
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
COPY MRDEF from '@META@/MRDEF.RRF' with delimiter as '|' null as '';
alter table mrdef drop column dummy;

DROP TABLE MRHIER;
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
COPY MRHIER from '@META@/MRHIER.RRF' with delimiter as '|' null as '';
ALTER TABLE mrhier DROP COLUMN dummy;

DROP TABLE MRSAB;
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
COPY MRSAB from '@META@/MRSAB.RRF' with delimiter as '|' null as '';
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
COPY MRSTY from '@META@/MRSTY.RRF' with delimiter as '|' null as '';
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
copy MRCUI from '@META@/MRCUI.RRF' with delimiter as '|' null as '';
alter table mrcui drop column dummy;
