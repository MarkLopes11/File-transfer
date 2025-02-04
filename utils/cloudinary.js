// src/utils/cloudinary.js
import { Cloudinary as CoreCloudinary } from 'cloudinary-core';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET; 

const cloudinaryCore = new CoreCloudinary({ cloud_name: cloudName }, { secure: true });

export { cloudName, apiKey, apiSecret, cloudinaryCore };