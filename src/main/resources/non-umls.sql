
drop table if exists non_umls_vocs;
create table non_umls_vocs (
  id serial primary key,
  abbr text not null,
  full_name text,
  ver text not null -- SOURCE_VERSION/IMPORT_VERSION
);

drop view if exists non_umls_latest_vocs;
create view non_umls_latest_vocs
as
  select voc.*
  from non_umls_vocs as voc
  join (
    select abbr, max(ver) as ver
    from non_umls_vocs
    group by abbr
  ) as latest
  on voc.abbr = latest.abbr and voc.ver = latest.ver;

drop table if exists non_umls_codes;
create table non_umls_codes (
  id serial primary key,
  voc_id int not null references non_umls_vocs(id),
  code varchar(255) not null,
  term text not null,
  rel char(2) not null,     -- EQ NR
  cui char(8) not null,
  umls_code varchar(255),
  umls_sab varchar(40)
);
create index non_umls_codes_voc_id on non_umls_codes(voc_id);
create index non_umls_codes_code on non_umls_codes(code);
create index non_umls_codes_cui on non_umls_codes(cui);

-- all non-umls codes from the latest version of each vocabulary
drop view if exists non_umls_latest_codes;
create view non_umls_latest_codes
as
  select voc.abbr as voc_abbr, voc.ver voc_ver, code.code, code.term, code.cui, code.rel
  from non_umls_vocs voc
  join (
    select abbr, max(ver) as ver
    from non_umls_vocs
    group by abbr
  ) as latest
  on voc.abbr = latest.abbr and voc.ver = latest.ver
  join non_umls_codes code
  on voc.id = code.voc_id;

insert into non_umls_vocs (abbr, full_name, ver)
values ('ICD10DA', 'ICD-10 Danish version', '20231214/a');

insert into non_umls_vocs (abbr, full_name, ver)
values ('MEDCODEID', 'CPRD Medical Dictionary', '20240101/a');

insert into non_umls_vocs (abbr, full_name, ver)
values ('RCD2', 'Read codes, version 2', '20160101-1');

insert into non_umls_vocs (abbr, full_name, ver)
values ('TEST', 'Non-UMLS testing vocabulary', '20240609/a');
insert into non_umls_vocs (abbr, full_name, ver)
values ('TEST', 'Non-UMLS testing vocabulary', '20240609/b');
insert into non_umls_vocs (abbr, full_name, ver)
values ('TEST', 'Non-UMLS testing vocabulary', '20240609/c');

-- insert into non_umls_codes (voc_id, code, term, rel, cui)
-- with codes(code, term, rel, cui) as (
--   values 
--     ('OLD', 'Old code 1', 'EQ', 'C0001122')
-- )
-- select id, code, term, rel, cui
-- from codes cross join non_umls_vocs
-- where abbr = 'TEST' and ver = '20240609/a';

-- insert into non_umls_codes (voc_id, code, term, rel, cui)
-- with codes(code, term, rel, cui) as (
--   values 
--     ('10', 'Fever',         'EQ', 'C0015967'),
--     ('20', 'Headache',      'EQ', 'C0018681'),
--     ('21', 'Very headache', 'RN', 'C0018681'),
--     ('30', 'Acidosis',      'EQ', 'C0001122'),
--     ('31', 'Acidosis 2',    'RN', 'C0001122'),
--     ('32', 'Acidosis 3',    'RN', 'C0001122'),
--     ('33', 'Autoimmune thyroiditis', 'EQ', 'C0920350')
-- )
-- select id, code, term, rel, cui
-- from codes
-- cross join non_umls_vocs
-- where abbr = 'TEST' and ver = '20240609/c';
