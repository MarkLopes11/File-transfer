"use client"

import { useState, useRef } from "react"
import QRCode from "react-qr-code"
import { FaCloudUploadAlt, FaCheckCircle, FaClipboardCheck } from "react-icons/fa"
import { MdError } from "react-icons/md"
import { motion, AnimatePresence } from "framer-motion"

const FileUpload = () => {
  const [file, setFile] = useState(null)
  const [downloadLink, setDownloadLink] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const [copySuccess, setCopySuccess] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      console.log("Selected file:", selectedFile);
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Please select a file!");
      return;
    }
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file); // Append the file with the field name 'file'

      const response = await fetch("/api/bunkr_upload", { // Call the Next.js API route
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json(); // Expect JSON error response from API route
        console.error("API route error:", response.status, errorData);
        setUploadError(errorData.error || `Upload failed: Status ${response.status}`); // Use error message from API route if available
      } else {
        const data = await response.json(); // Expect JSON success response from API route
        console.log("API route response to frontend:", data);
        if (data && data.downloadLink) {
          setDownloadLink(data.downloadLink);
        } else {
          setUploadError("Upload successful, but download link not received.");
          console.error("Download link missing in API response:", data);
        }
      }

    } catch (error) {
      console.error("Frontend upload error:", error);
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleChooseFileClick = () => {
    fileInputRef.current.click()
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadLink);
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
    }, 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 border rounded-2xl shadow-lg bg-white"
    >
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
        <FaCloudUploadAlt className="inline-block mr-2 text-blue-500" />
        File Upload
      </h2>
      {!downloadLink && (
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative w-full py-6 px-5 text-center rounded-lg border-2 border-dashed border-blue-300 cursor-pointer hover:border-blue-500 transition-colors duration-200 bg-blue-50"
          onClick={handleChooseFileClick}
        >
          <FaCloudUploadAlt className="mx-auto text-4xl text-blue-500 mb-2" />
          <span className="text-gray-700 font-medium">{file ? file.name : "Choose a file or drag it here"}</span>
          <input
            type="file"
            onChange={(e) => {
              handleFileChange(e);
              e.target.value = null; // Reset input field after file selection
            }}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            ref={fileInputRef}
            disabled={uploading}
          />
        </motion.div>
      )}
      {!downloadLink && (
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 rounded-md bg-red-100 border border-red-400 text-red-700 flex items-center"
            >
              <MdError className="mr-2" />
              {uploadError}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!downloadLink && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`mt-6 w-full py-3 px-5 rounded-md text-white font-semibold transition-all duration-200 ${uploading || !file
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg"
            }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin h-5 w-5 mr-3 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Uploading...</span>
            </div>
          ) : (
            "Upload File"
          )}
        </motion.button>
      )}
      <AnimatePresence>
        {downloadLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 p-6 rounded-lg bg-green-50 text-center"
          >
            <p className="font-semibold text-green-700 flex items-center justify-center text-lg mb-8">
              <FaCheckCircle className="mr-2" /> File Uploaded Successfully!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className=" bg-blue-600 text-white p-3 flex-1 rounded-lg flex items-center justify-center font-medium"
              >
                {copySuccess ? (
                  <>
                    <FaClipboardCheck className="mr-2 text-green-500" /> Copied!
                  </>
                ) : (
                  "Copy Link"
                )}
              </button>
              <a
                href={downloadLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border-2 flex-1 border-blue-600 p-3 flex items-center justify-center font-medium"
              >
                Download Link
              </a>
            </div>

            <div className="mt-4 flex justify-center">
              <QRCode value={downloadLink} size={300} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default FileUpload