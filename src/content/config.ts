import { defineCollection } from 'astro:content';
import { notionLoader } from 'notion-astro-loader';

const blog = defineCollection({
  loader: notionLoader({
    auth: import.meta.env.NOTION_TOKEN,
    database_id: import.meta.env.NOTION_DATABASE_ID,
    filter: { property: 'Status', select: { equals: 'Published' } }
  }),
});

export const collections = { blog };
