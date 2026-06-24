-- Content management: blog posts, email templates, and social media cards

CREATE TABLE IF NOT EXISTS content_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  content_type        text NOT NULL DEFAULT 'blog_post'
                        CHECK (content_type IN (
                          'blog_post','email_template',
                          'social_facebook','social_linkedin','social_instagram','social_pinterest'
                        )),
  source_id           uuid REFERENCES content_items(id) ON DELETE SET NULL,
  title               text NOT NULL,
  slug                text,
  subject             text,         -- email templates
  preheader           text,         -- email templates
  content             text NOT NULL DEFAULT '',
  excerpt             text,
  featured_image_url  text,
  gallery             jsonb DEFAULT '[]'::jsonb,   -- [{url,alt,caption}]
  video_url           text,
  image_url           text,         -- social cards
  hashtags            text[] DEFAULT '{}',
  tags                text[] DEFAULT '{}',
  categories          text[] DEFAULT '{}',
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','scheduled','published','archived')),
  published_at        timestamptz,  -- future = scheduled, past = published date
  meta_title          text,
  meta_description    text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_items_slug_unique
  ON content_items(slug)
  WHERE slug IS NOT NULL AND slug != '';

CREATE INDEX IF NOT EXISTS content_items_type_idx        ON content_items(content_type);
CREATE INDEX IF NOT EXISTS content_items_status_idx      ON content_items(status);
CREATE INDEX IF NOT EXISTS content_items_source_idx      ON content_items(source_id);
CREATE INDEX IF NOT EXISTS content_items_published_at_idx ON content_items(published_at DESC);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_content_items" ON content_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','admin')
        AND users.status = 'active'
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "public_read_published_content" ON content_items
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
