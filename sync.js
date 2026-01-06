require('dotenv').config();
const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

// Configuration
const SYNC_MODE = process.env.SYNC_MODE || "full"; // "full" or "incremental"

// Initialize Notion client with the new API version
const notion = new Client({ 
  auth: process.env.NOTION_TOKEN,
  notionVersion: "2025-09-03"
});
const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
  const databaseId = process.env.DATABASE_ID;
  const postsDir = path.join(__dirname, "_posts");  // Jekyll requires _posts folder!

  console.log(`Starting sync with mode: ${SYNC_MODE}`);
  console.log(`Database ID: ${databaseId}`);

  try {
    // Step 1: Get the database to find its data sources
    console.log("Fetching database...");
    const database = await notion.databases.retrieve({
      database_id: databaseId
    });

    if (!database.data_sources || database.data_sources.length === 0) {
      console.error("No data sources found in this database!");
      return;
    }

    const dataSourceId = database.data_sources[0].id;
    console.log(`Using data source: ${database.data_sources[0].name || 'Default'} (${dataSourceId})`);

    // Step 2: Prepare posts directory
    if (SYNC_MODE === "full") {
      // Full sync: Clear everything and start fresh
      console.log("Full sync mode: Clearing posts directory...");
      if (fs.existsSync(postsDir)) {
        fs.rmSync(postsDir, { recursive: true, force: true });
      }
      fs.mkdirSync(postsDir);
    } else {
      // Incremental sync: Keep existing files, only update/add new ones
      console.log("Incremental sync mode: Keeping existing files...");
      if (!fs.existsSync(postsDir)) {
        fs.mkdirSync(postsDir);
      }
    }

    // Step 3: Query the data source for "Published" pages
    console.log("Querying for published posts...");
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "Status",
        status: {
          equals: "Published",
        },
      },
    });

    console.log(`Found ${response.results.length} published posts`);

    if (response.results.length === 0) {
      console.log("No published posts found. Make sure your Notion Status is set to 'Published'.");
      return;
    }

    // Step 4: Track which files we're syncing (for cleanup in incremental mode)
    const syncedFiles = new Set();
    const notionIdToFile = {};

    // Step 5: Process each page
    for (const page of response.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const date = page.created_time.split("T")[0];
      const notionId = page.id;

      // Create a URL-friendly filename (slug)
      const fileName = `${date}-${title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}.md`;

      syncedFiles.add(fileName);
      notionIdToFile[notionId] = fileName;

      // Check if file needs updating (in incremental mode)
      const filePath = path.join(postsDir, fileName);
      let shouldUpdate = true;

      if (SYNC_MODE === "incremental" && fs.existsSync(filePath)) {
        // Check if page was modified after file
        const fileStats = fs.statSync(filePath);
        const pageLastEdited = new Date(page.last_edited_time);
        const fileModified = fileStats.mtime;

        if (pageLastEdited <= fileModified) {
          console.log(`[⊙] Skipped (unchanged): ${title}`);
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        // Convert Page Content to Markdown
        const mdblocks = await n2m.pageToMarkdown(page.id);
        const mdString = n2m.toMarkdownString(mdblocks);

        // Build Frontmatter
        const frontmatter = [
          "---",
          `title: "${title}"`,
          `date: ${date}`,
          `notion_id: ${page.id}`,
          `last_edited: ${page.last_edited_time}`,
          "---",
          "\n"
        ].join("\n");

        fs.writeFileSync(filePath, frontmatter + mdString.parent);
        console.log(`[✓] Synced: ${title}`);
      }
    }

    // Step 6: Clean up deleted/unpublished posts (in incremental mode)
    if (SYNC_MODE === "incremental") {
      console.log("\nChecking for deleted/unpublished posts...");
      const existingFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
      
      for (const file of existingFiles) {
        if (!syncedFiles.has(file)) {
          // Check if this file was synced from Notion by looking for notion_id in frontmatter
          const filePath = path.join(postsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (content.includes('notion_id:')) {
            fs.unlinkSync(filePath);
            console.log(`[✗] Deleted: ${file} (no longer published in Notion)`);
          }
        }
      }
    }

    console.log(`\n✅ Success! ${response.results.length} posts synced to /posts`);
    console.log(`Mode: ${SYNC_MODE}`);

  } catch (error) {
    console.error("❌ Error during sync:");
    
    if (error.code === 'notionhq_client_request_timeout') {
      console.error("Request timed out. Please try again.");
    } else if (error.code === 'object_not_found') {
      console.error("Database not found. Check your DATABASE_ID and make sure the integration has access.");
    } else if (error.body) {
      try {
        const errorBody = JSON.parse(error.body);
        console.error(JSON.stringify(errorBody, null, 2));
      } catch {
        console.error(error.body);
      }
    } else {
      console.error(error.message || error);
    }
    
    console.error("\nFull error:", error);
  }
})();