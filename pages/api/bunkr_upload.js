// pages/api/bunkr_upload.js
import { IncomingForm } from 'formidable';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import * as cheerio from 'cheerio'; // Import cheerio

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const BUNKR_API_URL = "https://n25.bunkr.ru/api/upload";
    const BUNKR_TOKEN=process.env.BUNKR_TOKEN;

    if (!BUNKR_TOKEN) {
        console.error("BUNKR_TOKEN environment variable is not set!");
        return res.status(500).json({ error: "Server configuration error: BUNKR_TOKEN not set" });
    }

    try {
        const form = new IncomingForm();

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error("Form parse error:", err);
                return res.status(500).json({ error: "Error parsing form data" });
            }

            if (!files.file || !files.file[0]) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const file = files.file[0];

            const formData = new FormData();
            const fileStream = fs.createReadStream(file.filepath);
            formData.append("files[]", fileStream, {
                filename: file.originalFilename,
                contentType: file.mimetype || 'application/octet-stream'
            });

            const headers = {
                "accept": "application/json",
                "token": BUNKR_TOKEN,
                ...formData.getHeaders()
            };

            console.log("Sending request to Bunkr API...");

            const bunkrResponse = await fetch(BUNKR_API_URL, {
                method: "POST",
                headers: headers,
                body: formData
            });

            if (!bunkrResponse.ok) {
                const errorText = await bunkrResponse.text();
                console.error("Bunkr upload error:", bunkrResponse.status, errorText);
                return res.status(bunkrResponse.status).json({ error: `Bunkr API error: ${bunkrResponse.status}`, bunkrError: errorText });
            }

            const data = await bunkrResponse.json();
            console.log("Bunkr API response:", data);

            if (data && data.files && data.files[0] && data.files[0].url) {
                const filePageUrl = data.files[0].url;
                console.log("File Page URL from Bunkr API:", filePageUrl);

                let directDownloadUrl = null;

                try {
                    console.log("Fetching file page to extract direct download link:", filePageUrl);
                    const filePageResponse = await fetch(filePageUrl, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.5",
                        }
                    });

                    if (!filePageResponse.ok) {
                        console.error("Failed to fetch file page:", filePageResponse.status);
                        // Fallback to returning filePageUrl if fetching file page fails
                        return res.status(200).json({ downloadLink: filePageUrl, directDownloadLink: null, error: "Could not fetch file page to extract direct link" });
                    }

                    const pageHtml = await filePageResponse.text();
                    const $ = cheerio.load(pageHtml);

                    // CSS selector for the download button (based on your screenshot)
                    const downloadButton = $('a.btn.btn-main.btn-lg.rounded-full.px-6.font-semibold.ic-download-01.ic-before.before\\:text-lg');

                    if (downloadButton.length > 0) {
                        directDownloadUrl = downloadButton.attr('href');
                        console.log("Direct download URL extracted:", directDownloadUrl);
                    } else {
                        console.warn("Download button not found on file page.");
                        // Fallback to filePageUrl if download button not found
                        return res.status(200).json({ downloadLink: filePageUrl, directDownloadLink: null, error: "Download button not found on file page" });
                    }

                } catch (linkExtractionError) {
                    console.error("Error extracting direct download link:", linkExtractionError);
                    // Fallback to filePageUrl if there's an error during link extraction
                    return res.status(200).json({ downloadLink: filePageUrl, directDownloadLink: null, error: "Error extracting direct download link", technicalError: linkExtractionError.message });
                }

                // Return both filePageUrl and directDownloadLink (directDownloadLink might be null if extraction failed)
                return res.status(200).json({ downloadLink: directDownloadUrl || filePageUrl, directDownloadLink: directDownloadUrl, filePageUrl: filePageUrl });


            } else {
                console.error("File URL not found in Bunkr response:", data);
                return res.status(500).json({ error: "File URL not found in Bunkr API response", bunkrResponse: data });
            }
        });

    } catch (error) {
        console.error("Backend API error:", error);
        return res.status(500).json({ error: "Backend API error", technicalError: error.message });
    }
}