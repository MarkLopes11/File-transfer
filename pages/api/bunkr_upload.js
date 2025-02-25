// pages/api/bunkr_upload.js
import { IncomingForm } from 'formidable';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data'; // Use standard form-data package instead

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const BUNKR_API_URL = "https://n15.bunkr.ru/api/upload";
    const BUNKR_TOKEN = process.env.BUNKR_TOKEN;

    if (!BUNKR_TOKEN) {
        console.error("BUNKR_TOKEN environment variable is not set!");
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        // Parse incoming form data
        const form = new IncomingForm();
        
        const { fields, files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        if (!files.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = files.file[0];
        console.log("File received:", file.originalFilename, "Size:", file.size);

        // Create a new FormData instance using the form-data package
        const formData = new FormData();
        
        // Append the file as a readable stream directly from the file path
        const fileStream = fs.createReadStream(file.filepath);
        formData.append("files[]", fileStream, {
            filename: file.originalFilename,
            contentType: file.mimetype || 'application/octet-stream'
        });

        const headers = {
            "accept": "application/json",
            "accept-language": "en-US,en;q=0.6",
            "cache-control": "no-cache",
            "origin": "https://dash.bunkr.cr",
            "referer": "https://dash.bunkr.cr/",
            "sec-ch-ua": '"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "sec-gpc": "1",
            "token": BUNKR_TOKEN,
            "user-agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest'
            // Note: Don't manually set Content-Type when using form-data package
            // It will set the correct boundary automatically
        };

        // Get content-type header with proper boundary from form-data
        Object.assign(headers, formData.getHeaders());
        
        console.log("Sending request to Bunkr API...");
        
        const bunkrResponse = await fetch(BUNKR_API_URL, {
            method: "POST",
            headers: headers,
            body: formData
        });

        if (!bunkrResponse.ok) {
            const errorText = await bunkrResponse.text();
            console.error("Bunkr upload error:", bunkrResponse.status, errorText);
            
            try {
                const errorData = JSON.parse(errorText);
                return res.status(bunkrResponse.status).json({ 
                    error: `Upload failed: Status ${bunkrResponse.status}`, 
                    bunkrError: errorData 
                });
            } catch (e) {
                // If response isn't valid JSON
                return res.status(bunkrResponse.status).json({ 
                    error: `Upload failed: Status ${bunkrResponse.status}`, 
                    bunkrError: errorText 
                });
            }
        }

        const data = await bunkrResponse.json();
        console.log("Bunkr API response:", data);

        if (data && data.files && data.files[0] && data.files[0].url) {
            return res.status(200).json({ downloadLink: data.files[0].url });
        } else {
            console.error("Download link not found in Bunkr response:", data);
            return res.status(500).json({ 
                error: "Upload successful, but download link not found in response.",
                responseData: data
            });
        }

    } catch (error) {
        console.error("Backend API route error:", error);
        return res.status(500).json({ 
            error: "File upload failed on the server.", 
            technicalError: error.message,
            stack: error.stack
        });
    } finally {
        // Cleanup any temporary files if needed
    }
}