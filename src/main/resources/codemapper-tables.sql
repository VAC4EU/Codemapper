drop table if exists users;

create table users (
  id int not null auto_increment,  
  username char(100) not null unique,
  password char(64) not null,
  email text,
  anonymous boolean default false,
  primary key (id)
);

insert into users (id, username, password) values
(1, "admin", "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"),
(2, "user1", "0a041b9462caa4a31bac3567e0b6e6fd9100787db2ab433d96f6d178cabfce90"),
(3, "user2", "6025d18fe48abd45168528f18a82e265dd98d421a7084aa09f61b341703901a3"),
(4, "user3", "5860faf02b6bc6222ba5aca523560f0e364ccd8b67bee486fe8bf7c01d492ccb");

drop table if exists projects;

create table projects (
  id int not null auto_increment,
  name char(100) not null unique,
  primary key (id)
);

insert into projects (id, name) values
(1, "ADVANCE"),
(2, "EMIF");

drop table if exists users_projects;

create table users_projects (
  user_id int not null references users(id),
  project_id int not null references projects(id),
  -- A: admin/PI, E: editor, C: commentator
  role char(1) not null,
  unique (user_id, project_id)
);

-- MIGRATION
drop index idx_20366_user_project_unique;
alter table users_projects add constraint users_projects_unique unique (user_id, project_id);

insert into users_projects (user_id, project_id, role) values
(2, 1, 'A'),
(2, 2, 'E'),
(3, 1, 'E'),
(4, 2, 'C');

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

drop table if exists case_definitions;
create table case_definitions (
  id int not null auto_increment,
  uuid uuid not null default uuid_generate_v1(), -- public identifier
  name char(255),                                -- variable name
  old_name char(255)                             -- fixed old name
  project_id int not null references projects(id),
  state mediumtext,
  primary key (id)
  unique (uuid)
);
-- -- MIGRATION
-- alter table case_definitions add column old_name char(255);
-- update case_definitions set old_name = name;
-- alter table case_definitions add column uuid UUID NOT NULL DEFAULT uuid_generate_v1()
-- drop index idx_20337_project_id;

drop view if exists users_and_projects;
create view users_and_projects
as
select
u.username user_name,
up.role,
p.name project_name,
u.id user_id,
p.id project_id
from users_projects up
inner join users u on u.id = up.user_id
inner join projects p on p.id = up.project_id;

drop view if exists projects_case_definitions;
create view projects_case_definitions
as
  select
    p.id project_id,
    p.name project_name,
    cd.id case_definition_id,
    cd.name case_definition_name
  from projects p
  join case_definitions cd
  on p.id = cd.project_id
  order by project_name, case_definition_name;

drop view if exists projects_mappings_uuid;
create view projects_mappings_uuid
as
  select
    p.id project_id,
    p.name project_name,
    cd.id mapping_id,
    cd.name mapping_name,
    cd.uuid mapping_uuid,
    cd.old_name mapping_old_name
  from projects p
  join case_definitions cd
  on p.id = cd.project_id
  order by p.name, cd.name;

drop table if exists case_definition_revisions;
create table case_definition_revisions (
  id serial primary key,
  case_definition_id int not null references case_definitions(id),
  version int not null, -- unique serial per case_definition_id
  user_id int not null references users(id),
  timestamp TIMESTAMP not null default CURRENT_TIMESTAMP,
  summary text not null,
  mapping jsonb not null,
  constraint case_definition_version UNIQUE (case_definition_id, version)
);

drop table if exists cached_descendants;
create table cached_descendants (
  id int generated always as identity,
  last_access timestamp DEFAULT now(),
  vsab varchar(20),
  code varchar(100),
  descendants text
);

create or replace function set_cached_descendants(
  vsab varchar(20),
  code varchar(100),
  descendants text
) returns void as $$
insert into cached_descendants (vsab, code, descendants)
values (set_cached_descendants.vsab, set_cached_descendants.code, set_cached_descendants.descendants) 
$$ language sql;

create or replace function get_cached_descendants(
  vsab varchar(20),
  codes varchar[]
) returns table (
  code varchar(20),
  descendants text
) as $$
update cached_descendants set last_access = NOW()
where vsab = get_cached_descendants.vsab
and code = any(codes)
returning code, descendants
$$ language sql;

create or replace function evict_cached_descendants (keep int)
returns void
as $$
delete from cached_descendants where id in
( select id from cached_descendants
  order by last_access desc
  offset evict_cached_descendants.keep )
$$ language sql;

create or replace function set_revision_version()
returns trigger as $$
begin
  new.version = coalesce((
    select max(version)
    from case_definition_revisions
    where case_definition_id = new.case_definition_id
  ), 0) + 1;
  return new;
end;
$$ language plpgsql;

create trigger set_revision_version_trigger
create trigger set_revision_version_trigger
before insert on case_definition_revisions
for each row
execute procedure set_revision_version();

create index case_definition_revisions_case_definition_id on case_definition_revisions(case_definition_id);
create index case_definition_revisions_timestamp on case_definition_revisions(timestamp);
create index case_definition_revisions_version on case_definition_revisions(version);
before insert on case_definition_revisions
for each row
execute procedure set_revision_version();

create index case_definition_revisions_case_definition_id on case_definition_revisions(case_definition_id);
create index case_definition_revisions_timestamp on case_definition_revisions(timestamp);
create index case_definition_revisions_version on case_definition_revisions(version);

alter table case_definitions alter column state drop not null;
alter table users add column anonymous boolean default false;
