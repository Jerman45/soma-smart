-- Specialized material categories for SOMA SMART uploads (books, TIE books, exam papers, etc.).
-- Safe to re-run where category names are unique.

insert into public.categories (name, description, icon) values
  ('TIE Books', 'Official Tanzania Institute of Education (TIE) textbooks and curriculum books.', 'book-open'),
  ('Textbooks', 'Core textbooks organized by subject and class.', 'book-open'),
  ('Past Examination Papers', 'Previous examination papers for practice and revision.', 'file-text'),
  ('National Examinations', 'NECTA and other national examination materials.', 'award'),
  ('Mock Examinations', 'Mock and pre-national examinations for practice.', 'clipboard-check'),
  ('Study Notes', 'Clear notes to support everyday learning.', 'notebook-text'),
  ('Revision Materials', 'Focused materials for revision and review.', 'repeat'),
  ('Subject Guides', 'Syllabi and guides to help navigate each subject.', 'compass'),
  ('Educational Documents', 'Useful documents for students and educators.', 'file'),
  ('Other Learning Resources', 'Additional important resources for learners.', 'layers')
on conflict (name) do nothing;
