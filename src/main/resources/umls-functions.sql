create or replace function auis (sab0 character varying, codes0 character varying[])
returns table (aui character varying (9))
      language plpgsql as
$$
begin
  return query
  select distinct c.aui from mrconso c
  where c.sab = sab0 and c.code = ANY(codes0);
end
$$;

create or replace function descendants (auis0 character varying[])
      returns table (path character varying[])
      language plpgsql as
$$
begin
  return query
  with recursive descendants as (
      select ARRAY[aui0] as path
      from unnest(auis0) as aui0
    union
      select * from (
        with descendants_inner as ( select * from descendants )
          select distinct ds.path || r.aui2
          from descendants_inner ds inner join mrrel r
          on ds.path[array_upper(ds.path, 1)] = r.aui1
          where r.rel in ('CHD') and r.aui2 is not null and r.aui2 != r.aui1
        union
          select distinct ds.path || r.aui1
          from descendants_inner ds inner join mrrel r
          on ds.path[array_upper(ds.path, 1)] = r.aui2
          where r.rel in ('PAR') and r.aui1 is not null and r.aui1 != r.aui2
    ) t
  )
  select distinct ds.path from descendants ds;
end
$$;

create or replace function descendant_codes (sab0 character varying, codes0 character varying[])
returns table (code0 character varying (100), code character varying (100), str text)
language plpgsql as
$$
begin
return query
with descs as (
  select *
  from descendants (array (select aui from auis (sab0, codes0)))
)
select distinct c0.code, c1.code, c1.str
from descs d
left join mrconso c0 on d.path[array_lower(d.path, 1)] = c0.aui
left join mrconso c1 on d.path[array_upper(d.path, 1)] = c1.aui
where c0.code != c1.code;
end
$$;

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
