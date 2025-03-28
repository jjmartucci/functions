import type { Context } from "@netlify/functions";

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

interface MetaData {
    title: string, description: string, image: string, url: string
}

async function fetchPageMetadata(url: string): Promise<MetaData | null> {
    if(!url) {
        return null;
    }
    try {
        // Fetch the HTML content of the URL
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/html',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const html = await response.text();

        // Create a JSDOM instance to parse the HTML
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Extract title
        const title = document.querySelector('title')?.textContent || '';

        // Extract description from meta tag
        const descriptionMeta = document.querySelector('meta[name="description"]');
        const description = descriptionMeta ? descriptionMeta.getAttribute('content') || '' : '';

        // Extract meta image from og:image
        const metaImageMeta = document.querySelector('meta[property="og:image"]');
        const image = metaImageMeta ? metaImageMeta.getAttribute('content') || '' : '';

        // Return extracted metadata
        return { title, description, image, url };

    } catch (error) {
        console.error('Error fetching page metadata:', error);
        return null;
    }
}


export default async (req: Request, context: Context) => {
    console.log(`function req: ${JSON.stringify(req)}`)
    
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
        
        const metadata = await fetchPageMetadata(url);
        
        if (metadata) {
            return new Response(JSON.stringify(metadata), { headers });
        } else {
            return new Response(JSON.stringify({ 
                error: "Failed to fetch metadata",
                message: "Could not retrieve metadata for the provided URL" 
            }), {
                status: 400,
                headers
            });
        }
    } catch (error) {
        console.error('Error in metadata function:', error);
        return new Response(JSON.stringify({ 
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error occurred"
        }), {
            status: 500,
            headers
        });
    }
}
