import type { Context } from "@netlify/functions";

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

interface MetaData {
    pageTitle: string, pageDescription: string, pageMetaImage: string
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
        const description = descriptionMeta ? descriptionMeta.getAttribute('content') : '';

        // Extract meta image from og:image
        const metaImageMeta = document.querySelector('meta[property="og:image"]');
        const metaImage = metaImageMeta ? metaImageMeta.getAttribute('content') : '';

        // Output the results
        console.log('Title:', title);
        console.log('Description:', description);
        console.log('Meta Image:', metaImage);

        // You can also assign them to variables if needed
        const pageTitle = title;
        const pageDescription = description;
        const pageMetaImage = metaImage;

        // Return extracted metadata
        return { pageTitle, pageDescription, pageMetaImage };

    } catch (error) {
        console.error('Error fetching page metadata:', error);
        return null;
    }
}


export default async (req: Request, context: Context) => {
    console.log(`function req: ${JSON.stringify(req)}`)
    fetchPageMetadata(req.url).then(metaData => {
        console.log(metadata)
        if (metaData) {
        }
    });
    return new Response("hello world")

}