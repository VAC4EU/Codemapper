
drop table if exists review_topic cascade;
create table review_topic (
  id serial primary key,
  case_definition_id int not null references case_definitions(id),
  cui char(8),
  sab varchar(40),
  code text,
  heading text,
  created_by int references users(id),
  created_at TIMESTAMP not null default CURRENT_TIMESTAMP,
  resolved boolean not null default false,
  resolved_by int references users(id),
  resolved_at TIMESTAMP
);

drop table if exists review_message cascade;
create table review_message (
  id serial primary key,
  topic_id int not null references review_topic(id),
  timestamp TIMESTAMP not null default CURRENT_TIMESTAMP,
  author_id int references users(id), -- null for imported messages
  content text not null
);

drop table if exists review_message_is_read;
create table review_message_is_read (
  message_id int not null references review_message(id),
  user_id int not null references users(id),
  constraint primary_keys primary key (message_id, user_id)
);

-- mark a topic as resolved by a given user
drop function if exists review_resolve_topic;
create function review_resolve_topic(topic_id int, username text, t timestamp)
returns void
as $$
update
  review_topic
set
  resolved = true,
  resolved_by = u.id,
  resolved_at = review_resolve_topic.t
from
  users as u
where
  review_topic.id = review_resolve_topic.topic_id
and
  u.username = review_resolve_topic.username
$$ language sql; 

-- delete all read-markers of messages for a (resolved) topic
drop function if exists review_reset_mark_read;
create function review_reset_mark_read(topic_id int) returns void
as $$
delete from review_message_is_read
where message_id in
( select id
  from review_message
  where topic_id = review_reset_mark_read.topic_id )
$$ language sql;

-- edit message if it belongs to the given user
drop function if exists review_edit_user_message;
create function review_edit_user_message(
  message_id int, username text, content text
) returns int as $$
  update review_message
  set content = review_edit_user_message.content
  where id = (
    select m.id
    from review_message m
    left join users u on u.id = m.author_id
    where u.username = review_edit_user_message.username
    and m.id = review_edit_user_message.message_id
  )
  returning id
$$ language sql;

-- create a new message
drop function if exists review_new_message;
create function review_new_message(topic_id int, content text, username text, t timestamp)
returns table (message_id int) as $$
with
  nobody as (
    select null::bigint id
  ),
  user1 as (
    select id from users u
    where u.username = review_new_message.username
  ),
  author as (
    select coalesce(user1.id, nobody.id) as id
    from nobody left join user1 on true
  ),
  content as (
    select case
      when exists (select from user1) then ''
      else coalesce(review_new_message.username || ': ', '')
    end || coalesce(review_new_message.content, '(no content)')
    as content
  ),
  message as (
    insert into review_message (topic_id, author_id, content, timestamp)
    select review_new_message.topic_id, a.id, c.content, review_new_message.t
    from author a, content c
    returning id
  ),
  x as (
    insert into review_message_is_read (message_id, user_id)
    select m.id, u.id
    from message m, users u
    where u.username = review_new_message.username
  )
  select * from message
$$ language sql;

-- create a new topic
drop function if exists review_new_topic;
create function review_new_topic(project text, casedef text, cui char(8), sab varchar(40), code text, heading text, username text, t timestamp)
returns table (topic_id int)
as $$
  with
  nobody as (select null::bigint id),
  user0 as (select id from users u where u.username = review_new_topic.username),
  user1 as (select coalesce(user0.id, nobody.id) as id from nobody left join user0 on true)
  insert into review_topic (case_definition_id, cui, sab, code, heading, created_by, created_at)
  select pc.case_definition_id, review_new_topic.cui, review_new_topic.sab, review_new_topic.code, review_new_topic.heading, u.id, review_new_topic.t
  from projects_case_definitions pc, user1 u
  where pc.project_name = review_new_topic.project 
  and pc.case_definition_name = review_new_topic.casedef
  returning id
$$ language sql;

drop function if exists review_new_topic_uuid;
drop function if exists review_new_topic_shortkey;
create function review_new_topic_shortkey(mapping_shortkey SHORTKEY, cui char(8), sab varchar(40), code text, heading text, username text, t timestamp)
returns table (topic_id int)
as $$
  with
  nobody as (select null::bigint id),
  user0 as (select id from users u where u.username = review_new_topic_shortkey.username),
  user1 as (select coalesce(user0.id, nobody.id) as id from nobody left join user0 on true)
  insert into review_topic (case_definition_id, cui, sab, code, heading, created_by, created_at)
  select cd.id, review_new_topic_shortkey.cui, review_new_topic_shortkey.sab, review_new_topic_shortkey.code, review_new_topic_shortkey.heading, u.id, review_new_topic_shortkey.t
  from case_definitions cd, user1 u
  where cd.shortkey = review_new_topic_shortkey.mapping_shortkey
  returning id
$$ language sql;

-- mark all messages of a topic read for a given user
drop function if exists review_mark_topic_read;
create function review_mark_topic_read(topic_id int, username text)
returns void
as $$
  insert into review_message_is_read (message_id, user_id)
  select m.id, u.id
  from review_message m, users u
  where m.topic_id = review_mark_topic_read.topic_id
  and u.username = review_mark_topic_read.username
  on conflict on constraint primary_keys do nothing
$$ language sql; 

-- get all messages
drop function if exists review_all_messages;
create function review_all_messages(project text, casedef text, username text)
  returns table (
    cui char(8), sab varchar(40), code text,
    topic_id int, topic_heading text,
    created_by text, created_at TIMESTAMP,
    resolved boolean, resolved_user text, resolved_timestamp TIMESTAMP,
    message_id int, message_author text, message_timestamp TIMESTAMP, message_content text,
    is_read boolean
  ) as $$
    select
      t.cui, t.sab, t.code, t.id, t.heading,
      cu.username, t.created_at,
      t.resolved, ru.username, t.resolved_at,
      m.id, mu.username, m.timestamp, m.content,
      r.message_id is not null
    from projects p
    inner join case_definitions c on c.project_id = p.id
    inner join review_topic t on t.case_definition_id = c.id
    left join users cu on cu.id = t.created_by
    left join review_message m on m.topic_id = t.id
    left join users mu on mu.id = m.author_id
    left join users ru on ru.username = review_all_messages.username
    left join review_message_is_read r on (r.message_id = m.id and r.user_id = ru.id)
    where p.name = review_all_messages.project
    and c.name = review_all_messages.casedef
    order by t.cui, t.sab, t.code, t.id, m.timestamp
$$ language sql;

drop function if exists review_all_messages_uuid;
drop function if exists review_all_messages_shortkey;
create function review_all_messages_shortkey(mapping_shortkey SHORTKEY, username text)
  returns table (
    cui char(8), sab varchar(40), code text,
    topic_id int, topic_heading text,
    created_by text, created_at TIMESTAMP,
    resolved boolean, resolved_user text, resolved_timestamp TIMESTAMP,
    message_id int, message_author text, message_timestamp TIMESTAMP, message_content text,
    is_read boolean
  ) as $$
    select
      t.cui, t.sab, t.code, t.id, t.heading,
      cu.username, t.created_at,
      t.resolved, ru.username, t.resolved_at,
      m.id, mu.username, m.timestamp, m.content,
      r.message_id is not null
    from case_definitions cd
    inner join review_topic t on t.case_definition_id = cd.id
    left join users cu on cu.id = t.created_by
    left join review_message m on m.topic_id = t.id
    left join users mu on mu.id = m.author_id
    left join users ru on ru.username = review_all_messages_shortkey.username
    left join review_message_is_read r on (r.message_id = m.id and r.user_id = ru.id)
    where cd.shortkey = review_all_messages_shortkey.mapping_shortkey
    order by t.cui, t.sab, t.code, t.id, m.timestamp
$$ language sql;

drop function if exists review_topic_created_by;
create function review_topic_created_by(topic_id int)
returns text
as $$
select u.username
from review_topic t
inner join users u on u.id = t.created_by 
where t.id = review_topic_created_by.topic_id
$$ language sql;

drop function if exists review_migrate_from_comments;
create function review_migrate_from_comments() returns void
as $$

insert into review_topic (case_definition_id, cui, created_by, created_at, heading)
select distinct c.case_definition_id, c.cui, c.author, c.timestamp, 'Comment' as heading
from comments c
inner join case_definitions cd
on c.case_definition_id = cd.id;

insert into review_message (topic_id, timestamp, author_id, content)
select t.id as topic_id, c.timestamp, c.author, c.content
from comments as c, review_topic as t
where c.case_definition_id = t.case_definition_id
and c.cui = t.cui

$$ language sql;
