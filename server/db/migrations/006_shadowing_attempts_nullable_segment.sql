-- Migration 006: Allow transcript_segment_id to be null in shadowing_attempts
alter table shadowing_attempts
  alter column transcript_segment_id drop not null;

alter table shadowing_attempts
  drop constraint if exists shadowing_attempts_transcript_segment_id_fkey;

alter table shadowing_attempts
  add constraint shadowing_attempts_transcript_segment_id_fkey
  foreign key (transcript_segment_id)
  references transcript_segments(id)
  on delete set null;
