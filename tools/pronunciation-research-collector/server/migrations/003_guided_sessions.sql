alter table research_collector_attempts
  drop constraint if exists research_collector_attempts_collection_mode_check;

alter table research_collector_attempts
  add constraint research_collector_attempts_collection_mode_check
  check (collection_mode in ('scripted', 'guided', 'free'));

alter table research_collector_attempts
  add column if not exists session_id uuid,
  add column if not exists session_step smallint check (session_step is null or session_step between 1 and 40);

create index if not exists research_collector_attempts_session_idx
  on research_collector_attempts(session_id, session_step)
  where session_id is not null;
