import type { Context } from "@netlify/functions";
import { Octokit } from "@octokit/rest";
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';

interface MetaData {
  id: string;
  title: string;
  description: string;
  image: string;
  url: string;
}

export default async (req: Request, context: Context) => {
  // Define common headers for all responses
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }
  
  // Check if it's a POST request
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: "Method not allowed", 
      message: "This endpoint only accepts POST requests" 
    }), {
      status: 405,
      headers
    });
  }
  
  try {
    // Extract data from request body
    const body = await req.json();
    const { metadata, API_KEY } = body;
    
    // Check API key
    const expectedApiKey = process.env.API_KEY;
    if (!API_KEY || API_KEY !== expectedApiKey) {
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        message: "Invalid or missing API key" 
      }), {
        status: 401,
        headers
      });
    }
    
    if (!metadata) {
      return new Response(JSON.stringify({ 
        error: "Missing metadata", 
        message: "Please provide metadata in the request body" 
      }), {
        status: 400,
        headers
      });
    }
    
    // GitHub configuration from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    
    if (!githubToken || !owner || !repo) {
      return new Response(JSON.stringify({ 
        error: "Configuration error", 
        message: "Missing GitHub configuration" 
      }), {
        status: 500,
        headers
      });
    }
    
    // Initialize Octokit with GitHub token
    const octokit = new Octokit({
      auth: githubToken
    });
    
    // Ensure metadata has an ID
    const metadataWithId: MetaData = metadata.id ? metadata : { ...metadata, id: uuidv4() };
    
    // Create YAML frontmatter
    const frontmatter = yaml.dump(metadataWithId);
    
    // Create markdown content with YAML frontmatter
    const markdownContent = `---
${frontmatter}---

# ${metadataWithId.title}

${metadataWithId.description || ''}

[Visit Original Link](${metadataWithId.url})
`;
    
    // Create a filename-safe version of the title
    const safeFilename = metadataWithId.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/^-+|-+$/g, '')     // Remove leading/trailing hyphens
      .substring(0, 100);          // Limit length
    
    // File path in the repository
    const filePath = `links/${safeFilename}.md`;
    
    // Check if file already exists
    let sha;
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });
      
      if ('sha' in fileData) {
        sha = fileData.sha;
      }
    } catch (error) {
      // File doesn't exist, which is fine for creating a new file
      console.log(`Creating new file: ${filePath}`);
    }
    
    // Create or update file in GitHub
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Add or update link: ${metadataWithId.title}`,
      content: Buffer.from(markdownContent).toString('base64'),
      branch,
      ...(sha ? { sha } : {})
    });
    
    return new Response(JSON.stringify({
      success: true,
      metadata: metadataWithId,
      github: {
        url: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
        commit: response.data.commit.sha
      }
    }), { headers });
    
  } catch (error) {
    console.error('Error in saveLinkToGithub function:', error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers
    });
  }
}
