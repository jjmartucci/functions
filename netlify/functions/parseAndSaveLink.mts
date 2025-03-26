import type { Context } from "@netlify/functions";

interface MetaData {
  title: string;
  description: string;
  image: string;
  url: string;
  tags?: string[];
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
    const { url, API_KEY } = body;
    
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
    
    if (!url) {
      return new Response(JSON.stringify({ 
        error: "Missing URL", 
        message: "Please provide a 'url' property in the request body" 
      }), {
        status: 400,
        headers
      });
    }
    
    // Step 1: Call metadata function to get metadata
    const metadataResponse = await fetch(`${context.site.url}/.netlify/functions/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, API_KEY })
    });
    
    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.json();
      return new Response(JSON.stringify({ 
        error: "Metadata extraction failed",
        message: errorData.message || "Failed to extract metadata from the URL",
        details: errorData
      }), {
        status: metadataResponse.status,
        headers
      });
    }
    
    const metadata = await metadataResponse.json();
    
    // Step 2: Call saveLinkToGithub function with the metadata
    const saveResponse = await fetch(`${context.site.url}/.netlify/functions/saveLinkToGithub`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ metadata, API_KEY })
    });
    
    if (!saveResponse.ok) {
      const errorData = await saveResponse.json();
      return new Response(JSON.stringify({ 
        error: "Saving to GitHub failed",
        message: errorData.message || "Failed to save the link to GitHub",
        details: errorData,
        metadata
      }), {
        status: saveResponse.status,
        headers
      });
    }
    
    const saveResult = await saveResponse.json();
    
    // Return success response with combined results
    return new Response(JSON.stringify({
      success: true,
      message: "Successfully processed and saved the link",
      metadata,
      github: saveResult.github
    }), { headers });
    
  } catch (error) {
    console.error('Error in parseAndSaveLink function:', error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers
    });
  }
}
