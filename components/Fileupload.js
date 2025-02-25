"use client"

import { useState, useRef,useEffect  } from "react"
import QRCode from "react-qr-code"
import { FaCloudUploadAlt, FaCheckCircle, FaClipboardCheck, FaExternalLinkAlt, FaTrashAlt } from "react-icons/fa"
import { MdError, MdInfo } from "react-icons/md"
import { motion, AnimatePresence } from "framer-motion"

const FileUpload = () => {
  const [files, setFiles] = useState([])
  const [uploadResults, setUploadResults] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const [copySuccess, setCopySuccess] = useState(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState(null)
  const [showUploadForm, setShowUploadForm] = useState(true)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFiles(prevFiles => [...prevFiles, ...newFiles])
      setUploadError(null)
    }
  }

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const getFileIcon = (fileType) => {
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('video')) return '🎬'
    if (fileType.includes('audio')) return '🎵'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('zip') || fileType.includes('rar')) return '🗜️'
    return '📁'
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadError("Please select at least one file!")
      return
    }
    setUploadError(null)
    setUploading(true)
    setSelectedResultIndex(null)

    try {
      const results = []

      // Upload files one by one
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/bunkr_upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          results.push({
            fileName: file.name,
            success: false,
            error: errorData.error || `Upload failed: Status ${response.status}`
          })
        } else {
          const data = await response.json()
          if (data && data.downloadLink) {
            results.push({
              fileName: file.name,
              success: true,
              downloadLink: data.downloadLink
            })
          } else {
            results.push({
              fileName: file.name,
              success: false,
              error: "Upload successful, but download link not received."
            })
          }
        }
      }

      // Preserve previous results and add new ones
      setUploadResults(prevResults => [...prevResults, ...results])
      
      // Check if all uploads failed
      const allFailed = results.every(result => !result.success)
      if (allFailed) {
        setUploadError("All file uploads failed. Please try again.")
      }

    } catch (error) {
      console.error("Frontend upload error:", error)
      setUploadError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
      setFiles([]) // Clear only the files after upload, not the results
      setShowUploadForm(false) // Hide the upload form after completion
    }
  }

  const handleChooseFileClick = () => {
    fileInputRef.current.click()
  }

  const handleCopyLink = (link, index) => {
    navigator.clipboard.writeText(link)
    setCopySuccess(index)
    setTimeout(() => {
      setCopySuccess(null)
    }, 1500)
  }

  const handleReset = () => {
    // Don't clear previous results, just show the upload form again
    setFiles([])
    setUploadError(null)
    setShowUploadForm(true)
  }

  const handleFileSelect = (index, e) => {
    if (selectedResultIndex === index) {
      setSelectedResultIndex(null)
      return
    }
    
    // Calculate position for the popover based on the clicked element
    const rect = e.currentTarget.getBoundingClientRect()
    const windowWidth = window.innerWidth
    
    // Determine if the popover should appear on the left or right
    // based on available screen space
    const showOnRight = rect.right + 300 < windowWidth
    
    setPopoverPosition({
      top: rect.top + window.scrollY,
      left: showOnRight ? rect.right + 10 + window.scrollX : rect.left - 300 + window.scrollX
    })
    
    setSelectedResultIndex(index)
  }

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedResultIndex !== null && 
          !event.target.closest('.qr-popover') && 
          !event.target.closest('.file-result-item')) {
        setSelectedResultIndex(null)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedResultIndex])

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full p-5 border rounded-xl shadow-md bg-white"
      >
        <div className="flex items-center justify-center mb-2">
          <span className="text-blue-500 mr-2 text-xl">
            <FaCloudUploadAlt />
          </span>
          <h2 className="text-xl font-bold text-gray-800">Multi-File Uploader</h2>
        </div>
        <p className="text-gray-600 text-center mb-4 text-xs">
          Upload files and get shareable links and QR codes.
        </p>

        {/* Success message after upload */}
        {uploadResults.length > 0 && !showUploadForm && (
          <div className="mb-4">
            <div className="py-2 px-3 rounded-lg bg-green-50 text-center">
              <p className="font-semibold text-green-700 flex items-center justify-center text-sm">
                <FaCheckCircle className="mr-2" /> 
                {uploadResults.filter(r => r.success).length} of {uploadResults.length} successful
              </p>
              <p className="text-xs text-gray-600 mt-1 flex items-center justify-center">
                <MdInfo className="mr-1" /> Click on any file to view its QR code and link
              </p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
          multiple
        />

        {/* Upload Form Section */}
        {showUploadForm && (
          <>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full py-4 px-4 text-center rounded-lg border-2 border-dashed
                ${files.length > 0 ? "border-green-500 bg-green-50" : "border-blue-300 bg-blue-50"}
                hover:border-blue-500 hover:bg-blue-100 cursor-pointer transition-colors duration-200`}
              onClick={handleChooseFileClick}
            >
              <FaCloudUploadAlt className={`mx-auto text-4xl ${files.length > 0 ? "text-green-600" : "text-blue-500"} mb-2`} />
              <span className="text-gray-700 font-medium text-sm">
                {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : "Click to Choose Files"}
              </span>
              <p className="text-xs text-gray-500 mt-1">Drag and drop files here or click to browse</p>
            </motion.div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 py-2 px-3 border-b font-medium text-gray-700 text-sm">
                  Selected Files ({files.length})
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <AnimatePresence>
                    {files.map((file, index) => (
                      <motion.div
                        key={`${file.name}-${index}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="py-2 px-3 border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getFileIcon(file.type)}</span>
                          <div>
                            <p className="font-medium text-gray-800 truncate max-w-xs text-sm">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="text-gray-500 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <FaTrashAlt size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <AnimatePresence>
              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 p-2 rounded-md bg-red-100 border border-red-400 text-red-700 flex items-center text-sm"
                >
                  <MdError className="mr-2" />
                  {uploadError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className={`mt-4 w-full py-2 px-4 rounded-lg text-white font-semibold transition-all duration-200 text-sm ${
                uploading || files.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
              }`}
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2 text-white"
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
                  <span>Uploading {files.length} file{files.length > 1 ? 's' : ''}...</span>
                </div>
              ) : (
                `Upload ${files.length} File${files.length > 1 ? 's' : ''}`
              )}
            </motion.button>
          </>
        )}

        {/* Upload Results Section */}
        {uploadResults.length > 0 && (
          <div className={`${!showUploadForm ? 'mt-0' : 'mt-4'}`}>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 py-2 px-3 border-b font-medium text-gray-700 text-sm flex items-center">
                <span>Uploaded Files ({uploadResults.length})</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {uploadResults.map((result, index) => (
                  <motion.div
                    key={`result-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`py-2 px-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer file-result-item ${
                      selectedResultIndex === index ? 'bg-blue-50' : ''
                    }`}
                    onClick={(e) => handleFileSelect(index, e)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getFileIcon('')}</span>
                        <div>
                          <span className="font-medium text-gray-800 truncate max-w-xs block text-sm">{result.fileName}</span>
                        </div>
                      </div>
                      {result.success ? (
                        <span className="text-green-600 flex items-center text-xs">
                          <FaCheckCircle className="mr-1" /> Success
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center text-xs">
                          <MdError className="mr-1" /> Failed
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {!showUploadForm && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleReset}
                className="mt-4 w-full py-2 px-4 rounded-lg text-blue-600 border border-blue-600 font-semibold transition-all duration-200 hover:bg-blue-50 text-sm"
              >
                Upload More Files
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      {/* QR Popover - Fixed positioned outside the main box */}
      <AnimatePresence>
        {selectedResultIndex !== null && uploadResults[selectedResultIndex]?.success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{ 
              position: 'fixed',
              top: `${popoverPosition.top}px`, 
              left: `${popoverPosition.left}px`,
              zIndex: 50,
            }}
            className="qr-popover w-72 h-auto bg-white rounded-xl shadow-xl border p-4"
          >
            <h3 className="font-bold text-sm mb-2 text-gray-800 truncate">{uploadResults[selectedResultIndex].fileName}</h3>
            
            <div className="flex justify-center mb-3">
              <QRCode 
                value={uploadResults[selectedResultIndex].downloadLink} 
                size={150} 
                bgColor="#ffffff" 
                fgColor="#000000" 
                level="M"
              />
            </div>
            
            <div className="mb-1 text-xs text-gray-500 font-medium">Download Link:</div>
            <div className="p-2 bg-gray-50 rounded-lg mb-3 break-all text-xs text-gray-700 max-h-16 overflow-y-auto">
              {uploadResults[selectedResultIndex].downloadLink}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(uploadResults[selectedResultIndex].downloadLink, selectedResultIndex);
                }}
                className="bg-blue-600 text-white p-2 flex-1 rounded-lg flex items-center justify-center font-medium hover:bg-blue-700 transition-colors text-xs"
              >
                {copySuccess === selectedResultIndex ? (
                  <>
                    <FaClipboardCheck className="mr-1" /> Copied!
                  </>
                ) : (
                  <>
                    <FaClipboardCheck className="mr-1" /> Copy Link
                  </>
                )}
              </button>
              <a
                href={uploadResults[selectedResultIndex].downloadLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border border-blue-600 p-2 flex-1 flex items-center justify-center font-medium hover:bg-blue-50 transition-colors text-xs"
              >
                <FaExternalLinkAlt className="text-blue-600 mr-1" size={12} /> 
                Open Link
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FileUpload