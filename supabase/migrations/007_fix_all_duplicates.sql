-- BISO INVEST - MIGRATION 007: CLEAN UP FAQ AND ANNOUNCEMENT DUPLICATES & ADD UNIQUE CONSTRAINTS

-- 1. FAQ DUPLICATES CLEANUP & UNIQUE CONSTRAINT
delete from faq a using faq b
where a.id > b.id and a.question = b.question;

alter table faq add constraint faq_question_unique unique (question);

-- 2. ANNOUNCEMENTS DUPLICATES CLEANUP & UNIQUE CONSTRAINT
delete from announcements a using announcements b
where a.id > b.id and a.title = b.title;

alter table announcements add constraint announcements_title_unique unique (title);
