-- Read-only catalog of public.maths_progress (columns, constraints, AcademicTrack enum, indexes).
-- Canonical text = result lines, blank lines dropped, sorted by byte value (LC_ALL=C), each line newline-terminated.
select 'col|'||column_name||'|'||udt_name||'|'||is_nullable||'|'||coalesce(column_default,'') from information_schema.columns where table_schema='public' and table_name='maths_progress'
union all select 'con|'||conname||'|'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.maths_progress'::regclass
union all select 'enum|AcademicTrack|'||string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='AcademicTrack'
union all select 'idx|'||indexname||'|'||indexdef from pg_indexes where schemaname='public' and tablename='maths_progress'
;
