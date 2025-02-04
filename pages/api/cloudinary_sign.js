// pages/api/cloudinary_sign.js
import { v2 as cloudinary } from 'cloudinary'; 
import { apiSecret, cloudName, apiKey } from '../../utils/cloudinary'; 

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret // server side
            });

            const timestamp = Math.round((new Date()).getTime() / 1000);
            const upload_preset = 'awtx0nm0';

            const signature = cloudinary.utils.api_sign_request(
                { timestamp: timestamp, upload_preset: upload_preset },
                cloudinary.config().api_secret
            );

            res.status(200).json({
                signature: signature,
                timestamp: timestamp,
                cloud_name: cloudinary.config().cloud_name,
                api_key: cloudinary.config().api_key, // Send the public API key,
                upload_preset: upload_preset
            });
        } catch (error) {
            console.error("Error generating Cloudinary signature:", error);
            res.status(500).json({ error: 'Failed to generate Cloudinary signature' });
        }
    } else {
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}