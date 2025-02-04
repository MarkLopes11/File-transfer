"use client"

import { useState, useRef } from "react"
import QRCode from "react-qr-code"
import { cloudName } from "../utils/cloudinary"
import { FaCloudUploadAlt, FaCheckCircle } from "react-icons/fa"
import { MdError } from "react-icons/md"
import { motion, AnimatePresence } from "framer-motion"

const FileUpload = () => {
  const [file, setFile] = useState(null)
  const [downloadLink, setDownloadLink] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Please select a file!")
      return
    }
    setUploadError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", "awtx0nm0")

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.error) {
        console.error("Cloudinary upload error:", data.error)
        setUploadError(`Upload failed: ${data.error.message}`)
      } else {
        setDownloadLink(data.secure_url)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      setUploadError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleChooseFileClick = () => {
    fileInputRef.current.click()
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
          onChange={handleFileChange}
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          ref={fileInputRef}
          disabled={uploading}
        />
      </motion.div>

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

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleUpload}
        disabled={uploading || !file}
        className={`mt-6 w-full py-3 px-5 rounded-md text-white font-semibold transition-all duration-200 ${
          uploading || !file
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

      <AnimatePresence>
        {downloadLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 p-6 rounded-lg bg-green-50 border border-green-200 text-center"
          >
            <p className="font-semibold text-green-700 flex items-center justify-center text-lg">
              <FaCheckCircle className="mr-2" /> File Uploaded Successfully!
            </p>
            <a
              href={downloadLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline block mt-3 hover:text-blue-800 font-medium"
            >
              Download Link
            </a>
            <div className="mt-4 flex justify-center">
              <QRCode value={downloadLink} size={150} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default FileUpload