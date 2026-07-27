create policy "admins manage lessons" on public.lessons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "admins manage lesson videos" on storage.objects for all to authenticated
using (bucket_id = 'lesson-videos' and public.has_role(auth.uid(),'admin'))
with check (bucket_id = 'lesson-videos' and public.has_role(auth.uid(),'admin'));

create policy "enrolled users read lesson videos" on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-videos'
  and exists (
    select 1 from public.enrollments e
    where e.user_id = auth.uid()
      and e.course_id::text = split_part(objects.name, '/', 1)
  )
);