// pages/api/bunkr_upload.js
import { IncomingForm } from 'formidable';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { FormData, Blob } from 'formdata-node'; // Import FormData and Blob from formdata-node

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
        // Use FormData from formdata-node
        const formData = new FormData();
        const files = await new Promise((resolve, reject) => {
            const form = new IncomingForm();
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve(files);
            });
        });

        if (!files.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = files.file[0];

        let fileBuffer;
        if (file.filepath) {
            try {
                fileBuffer = await fs.readFile(file.filepath);
            } catch (readError) {
                console.error("Error reading file:", readError);
                return res.status(500).json({ error: "Error reading uploaded file." });
            }
        } else {
            fileBuffer = Buffer.from(file.originalFilename);
            console.warn("Warning: Falling back to Buffer.from(file.originalFilename), verify file data handling");
        }

        // Create Blob from Buffer using formdata-node's Blob
        const fileBlob = new Blob([fileBuffer]); // Wrap fileBuffer in an array

        formData.append("files[]", fileBlob, file.originalFilename); // Use fileBlob

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
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        };

        const bunkrResponse = await fetch(BUNKR_API_URL, {
            method: "POST",
            headers: headers,
            body: formData,
        });

        if (!bunkrResponse.ok) {
            const errorData = await bunkrResponse.text();
            console.error("Bunkr upload error:", bunkrResponse.status, errorData);
            return res.status(bunkrResponse.status).json({ error: `Upload failed: Status ${bunkrResponse.status}` });
        }

        const data = await bunkrResponse.json();
        console.log("Bunkr API response from backend:", data);

        if (data && data.files && data.files[0] && data.files[0].url) {
            return res.status(200).json({ downloadLink: data.files[0].url });
        } else {
            console.error("Download link not found in Bunkr response:", data);
            return res.status(500).json({ error: "Upload successful, but download link not found in response." });
        }

    } catch (error) {
        console.error("Backend API route error:", error);
        return res.status(500).json({ error: "File upload failed on the server." });
    }
}