"use client"

import { useState, useRef, useEffect } from "react"
import QRCode from "react-qr-code"
import {
  FaCloudUploadAlt, FaCheckCircle, FaClipboardCheck,
  FaExternalLinkAlt, FaTrashAlt, FaStar, FaRegStar,
  FaMoon, FaSun, FaCompress, FaShareAlt, FaFilter
} from "react-icons/fa"
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
  const [darkMode, setDarkMode] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [filterFavorites, setFilterFavorites] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [showFilePreviews, setShowFilePreviews] = useState(true)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false); // ADDED: New state variable

  // Load saved results and preferences from localStorage on initial load
  useEffect(() => {
    const savedResults = localStorage.getItem('uploadResults')
    const savedDarkMode = localStorage.getItem('darkMode')
    const savedFavorites = localStorage.getItem('favorites')

    if (savedResults) {
      setUploadResults(JSON.parse(savedResults))
    }

    if (savedDarkMode) {
      setDarkMode(savedDarkMode === 'true')
    }

    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites))
    }
  }, [])

  // Save results and preferences to localStorage
  useEffect(() => {
    if (uploadResults.length > 0) {
      localStorage.setItem('uploadResults', JSON.stringify(uploadResults))
    }

    localStorage.setItem('darkMode', darkMode.toString())

    if (favorites.length > 0) {
      localStorage.setItem('favorites', JSON.stringify(favorites))
    }
  }, [uploadResults, darkMode, favorites])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFiles(prevFiles => [...prevFiles, ...newFiles])
      setUploadError(null)

      // Generate preview for image files
      newFiles.forEach(file => {
        if (file.type.includes('image')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            file.preview = e.target.result
            setFiles(prevFiles => [...prevFiles])
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const getFileIcon = (fileType) => {
    if (!fileType) return '📁'; // Default icon if fileType is undefined
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

    // Initialize progress for each file
    const initialProgress = {}
    files.forEach((file, index) => {
      initialProgress[index] = 0
    })
    setUploadProgress(initialProgress)

    try {
      const results = []

      // Upload files one by one
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append("file", file)

        // Simulate progress updates with XMLHttpRequest
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(prev => ({
              ...prev,
              [i]: percentComplete
            }))
          }
        })

        const uploadPromise = new Promise((resolve, reject) => {
          xhr.open('POST', '/api/bunkr_upload', true)

          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText)
                resolve(data)
              } catch (e) {
                reject(new Error("Invalid response format"))
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText)
                reject(errorData)
              } catch (e) {
                reject(new Error(`Upload failed: Status ${xhr.status}`))
              }
            }
          }

          xhr.onerror = function () {
            reject(new Error("Network error"))
          }

          xhr.send(formData)
        })

        try {
          const data = await uploadPromise

          if (data && data.downloadLink) {
            const timestamp = new Date().toISOString()
            results.push({
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              success: true,
              downloadLink: data.downloadLink,
              timestamp: timestamp,
              favorite: false
            })
          } else {
            results.push({
              fileName: file.name,
              success: false,
              error: "Upload successful, but download link not received."
            })
          }
        } catch (error) {
          results.push({
            fileName: file.name,
            success: false,
            error: error.error || "Upload failed"
          })
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
      // setShowUploadForm(false);  <-- REMOVED from here
      setUploadProgress({})
      setUploadComplete(true); // ADDED: Set uploadComplete to true
      console.log("FileUpload: finally block executed");
      console.log("FileUpload: showUploadForm state:", showUploadForm);
      console.log("FileUpload: uploadResults state:", uploadResults);
      console.log("FileUpload: uploadResults array:", uploadResults); // <-- ADDED LOGGING HERE
    }
  }

  // ADDED: useEffect to handle setShowUploadForm after upload completion
  useEffect(() => {
    if (uploadComplete) {
      setShowUploadForm(false);
      setUploadComplete(false); // Reset for next upload
    }
  }, [uploadComplete]);


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
    console.log("handleFileSelect called for index:", index); // CHECK 1: Is handleFileSelect being called?
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
    console.log("selectedResultIndex set to:", index); // CHECK 2: Is selectedResultIndex being set?
  }

  const toggleFavorite = (index, e) => {
    e.stopPropagation()

    const newUploadResults = [...uploadResults]
    newUploadResults[index].favorite = !newUploadResults[index].favorite
    setUploadResults(newUploadResults)

    if (newUploadResults[index].favorite) {
      setFavorites(prev => [...prev, newUploadResults[index].downloadLink])
    } else {
      setFavorites(prev => prev.filter(link => link !== newUploadResults[index].downloadLink))
    }
  }

  const deleteUploadResult = (index, e) => {
    e.stopPropagation()

    // If it's a favorite, remove from favorites list as well
    if (uploadResults[index].favorite) {
      setFavorites(prev => prev.filter(link => link !== uploadResults[index].downloadLink))
    }

    const newUploadResults = [...uploadResults]
    newUploadResults.splice(index, 1)
    setUploadResults(newUploadResults)

    if (selectedResultIndex === index) {
      setSelectedResultIndex(null)
    } else if (selectedResultIndex > index) {
      setSelectedResultIndex(selectedResultIndex - 1)
    }
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  const toggleFilterFavorites = () => {
    setFilterFavorites(!filterFavorites)
  }

  // Calculate dynamic UI classes based on dark mode
  const themeClasses = {
    mainBg: darkMode ? "bg-gray-900" : "bg-white",
    textColor: darkMode ? "text-gray-200" : "text-gray-800",
    secondaryTextColor: darkMode ? "text-gray-400" : "text-gray-600",
    cardBg: darkMode ? "bg-gray-800" : "bg-white",
    borderColor: darkMode ? "border-gray-700" : "border-gray-200",
    hoverBg: darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50",
    dropZoneBg: darkMode ? "bg-gray-800" : "bg-blue-50",
    dropZoneBorder: darkMode ? "border-blue-600" : "border-blue-300",
    dropZoneActiveBg: darkMode ? "bg-blue-900" : "bg-blue-100",
    dropZoneActiveBorder: darkMode ? "border-blue-400" : "border-blue-500",
    buttonBg: darkMode ? "bg-blue-700" : "bg-blue-600",
    buttonHoverBg: darkMode ? "hover:bg-blue-800" : "hover:bg-blue-700",
    buttonDisabledBg: darkMode ? "bg-gray-600" : "bg-gray-400",
    successBg: darkMode ? "bg-green-900" : "bg-green-50",
    successText: darkMode ? "text-green-400" : "text-green-700",
    errorBg: darkMode ? "bg-red-900" : "bg-red-100",
    errorText: darkMode ? "text-red-400" : "text-red-700",
  }

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounter.current++

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounter.current--

    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    setIsDragging(false)
    dragCounter.current = 0

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      setFiles(prevFiles => [...prevFiles, ...droppedFiles])
      setUploadError(null)

      // Generate preview for image files
      droppedFiles.forEach(file => {
        if (file.type.includes('image')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            file.preview = e.target.result
            setFiles(prevFiles => [...prevFiles])
          }
          reader.readAsDataURL(file)
        }
      })

      e.dataTransfer.clearData()
    }
  }

  const filteredResults = filterFavorites
    ? uploadResults.filter(result => result.favorite)
    : uploadResults

  const clearAllResults = () => {
    if (confirm("Are you sure you want to clear all upload history?")) {
      setUploadResults([])
      setFavorites([])
      localStorage.removeItem('uploadResults')
      localStorage.removeItem('favorites')
      setSelectedResultIndex(null)
    }
  }

  const downloadAllLinks = () => {
    const links = uploadResults
      .filter(result => result.success)
      .map(result => result.downloadLink)
      .join('\n')

    const element = document.createElement('a')
    const file = new Blob([links], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = 'upload-links.txt'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div
      className={`w-full max-w-2xl mx-auto relative ${themeClasses.mainBg} p-4 rounded-xl transition-colors duration-300`}
      onDragEnter={handleDragEnter}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-blue-500 border-dashed rounded-xl flex items-center justify-center z-50"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="text-center p-6 rounded-lg bg-white bg-opacity-90 shadow-lg">
            <FaCloudUploadAlt className="text-5xl text-blue-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-800">Drop your files here</p>
          </div>
        </div>
      )}

      {/* Theme Toggle and Actions Bar */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-700'}`}
        >
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>

        <div className="flex space-x-2">
          {uploadResults.length > 0 && (
            <>
              <button
                onClick={toggleFilterFavorites}
                className={`p-2 rounded-lg text-xs font-medium flex items-center ${
                  filterFavorites
                    ? 'bg-yellow-500 text-white'
                    : `${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`
                }`}
              >
                <FaStar className="mr-1" size={12} />
                {filterFavorites ? 'All Files' : 'Favorites'}
              </button>

              <button
                onClick={downloadAllLinks}
                className={`p-2 rounded-lg text-xs font-medium flex items-center ${
                  darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FaShareAlt className="mr-1" size={12} /> Export
              </button>

              <button
                onClick={clearAllResults}
                className={`p-2 rounded-lg text-xs font-medium flex items-center ${
                  darkMode ? 'bg-red-900 text-red-300 hover:bg-red-800' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                <FaTrashAlt className="mr-1" size={12} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full p-5 border rounded-xl shadow-md ${themeClasses.cardBg} ${themeClasses.borderColor}`}
      >
        <div className="flex items-center justify-center mb-2">
          <span className="text-blue-500 mr-2 text-xl">
            <FaCloudUploadAlt />
          </span>
          <h2 className={`text-xl font-bold ${themeClasses.textColor}`}>Multi-File Uploader</h2>
        </div>
        <p className={`text-center mb-4 text-xs ${themeClasses.secondaryTextColor}`}>
          Upload files and get shareable links and QR codes.
        </p>

        {/* Success message after upload */}
        {uploadResults.length > 0 && !showUploadForm && (
          <div className="mb-4">
            <div className={`py-2 px-3 rounded-lg ${themeClasses.successBg} text-center`}>
              <p className={`font-semibold ${themeClasses.successText} flex items-center justify-center text-sm`}>
                <FaCheckCircle className="mr-2" />
                {uploadResults.filter(r => r.success).length} of {uploadResults.length} successful
              </p>
              <p className={`text-xs ${themeClasses.secondaryTextColor} mt-1 flex items-center justify-center`}>
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
                ${files.length > 0
                  ? `border-green-500 ${darkMode ? 'bg-green-900 bg-opacity-30' : 'bg-green-50'}`
                  : `${themeClasses.dropZoneBorder} ${themeClasses.dropZoneBg}`}
                ${isDragging ? `${themeClasses.dropZoneActiveBorder} ${themeClasses.dropZoneActiveBg}` : ''}
                hover:border-blue-500 ${themeClasses.dropZoneActiveBg} cursor-pointer transition-colors duration-200`}
              onClick={handleChooseFileClick}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <FaCloudUploadAlt className={`mx-auto text-4xl ${files.length > 0 ? "text-green-600" : "text-blue-500"} mb-2`} />
              <span className={`font-medium text-sm ${themeClasses.textColor}`}>
                {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : "Click to Choose Files"}
              </span>
              <p className={`text-xs ${themeClasses.secondaryTextColor} mt-1`}>Drag and drop files here or click to browse</p>
            </motion.div>

            {/* File Preview Section */}
            {showFilePreviews && files.length > 0 && files.some(file => file.preview) && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {files.filter(file => file.preview).map((file, index) => (
                  <div key={`preview-${index}`} className="relative">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-16 object-cover rounded-md"
                    />
                    <div className="absolute top-0 right-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(files.findIndex(f => f === file));
                        }}
                        className="bg-red-500 text-white rounded-full p-1 text-xs"
                      >
                        <FaTrashAlt size={8} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <div className={`mt-3 border rounded-lg overflow-hidden ${themeClasses.borderColor}`}>
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} py-2 px-3 border-b ${themeClasses.borderColor} font-medium ${themeClasses.textColor} text-sm`}>
                  Selected Files ({files.length})
                </div>
                <div className={`max-h-48 overflow-y-auto ${themeClasses.cardBg}`}>
                  <AnimatePresence>
                    {files.map((file, index) => (
                      <motion.div
                        key={`${file.name}-${index}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`py-2 px-3 border-b ${themeClasses.borderColor} last:border-b-0 flex items-center justify-between ${themeClasses.hoverBg}`}
                      >
                        <div className="flex items-center overflow-hidden">
                          <span className="text-lg mr-2">{getFileIcon(file.type)}</span>
                          <div className="overflow-hidden">
                            <p className={`font-medium ${themeClasses.textColor} truncate max-w-xs text-sm`}>{file.name}</p>
                            <p className={`text-xs ${themeClasses.secondaryTextColor}`}>{formatFileSize(file.size)}</p>
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
                  className={`mt-3 p-2 rounded-md ${themeClasses.errorBg} border ${darkMode ? 'border-red-800' : 'border-red-400'} ${themeClasses.errorText} flex items-center text-sm`}
                >
                  <MdError className="mr-2" />
                  {uploadError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload Button with Progress Bar */}
            <div className="mt-4">
              {Object.keys(uploadProgress).length > 0 && (
                <div className="mb-2">
                  <div className="h-2 w-full bg-gray-300 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-200"
                      style={{
                        width: `${Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Object.keys(uploadProgress).length}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-500">
                    {Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Object.keys(uploadProgress).length)}% Complete
                  </p>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className={`w-full py-2 px-4 rounded-lg text-white font-semibold transition-all duration-200 text-sm ${
                  uploading || files.length === 0
                    ? themeClasses.buttonDisabledBg + " cursor-not-allowed"
                    : themeClasses.buttonBg + " " + themeClasses.buttonHoverBg + " shadow-md hover:shadow-lg"
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
            </div>
          </>
        )}

        {/* Upload Results Section */}
        {filteredResults.length > 0 && (
          <div className={`${!showUploadForm ? 'mt-0' : 'mt-4'}`}>
            {/* Added console logs for debugging */}
            {console.log("FileUpload: Rendering Upload Results Section")}
            {console.log("FileUpload: filteredResults:", filteredResults)}
            {console.log("FileUpload: showUploadForm (before section):", showUploadForm)}

            <div className={`border rounded-lg overflow-hidden ${themeClasses.borderColor}`}>
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} py-2 px-3 border-b ${themeClasses.borderColor} font-medium ${themeClasses.textColor} text-sm flex items-center justify-between`}>
                <span>
                  {filterFavorites ? 'Favorite Files' : 'Uploaded Files'} ({filteredResults.length})
                </span>

                {!filterFavorites && (
                  <button
                    onClick={toggleFilterFavorites}
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center"
                  >
                    <FaFilter className="mr-1" size={10} /> Filter
                  </button>
                )}
              </div>
              <div className={`max-h-64 overflow-y-auto ${themeClasses.cardBg}`}>
                {filteredResults.map((result, index) => (
                  <motion.div
                    key={`result-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`py-2 px-3 border-b last:border-b-0 ${themeClasses.borderColor} ${themeClasses.hoverBg} cursor-pointer file-result-item ${selectedResultIndex === index ? 'bg-blue-50' : ''}`}
                    onClick={(e) => handleFileSelect(index, e)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center overflow-hidden">
                        <span className="text-lg mr-2">{getFileIcon(result.fileType)}</span>
                        <div className="overflow-hidden">
                          <span className={`font-medium ${themeClasses.textColor} truncate max-w-xs block text-sm`}>{result.fileName}</span>
                          <p className={`text-xs ${themeClasses.secondaryTextColor}`}>{formatFileSize(result.fileSize)} • {result.timestamp ? new Date(result.timestamp).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={(e) => toggleFavorite(index, e)}
                          className={`p-1 rounded-full ${result.favorite ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'} transition-colors`}
                        >
                          {result.favorite ? <FaStar size={14} /> : <FaRegStar size={14} />}
                        </button>
                        <button
                          onClick={(e) => deleteUploadResult(index, e)}
                          className="text-gray-500 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <FaTrashAlt size={14} />
                        </button>
                      </div>
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
                className={`mt-4 w-full py-2 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${darkMode ? 'text-blue-300 border border-blue-700 hover:bg-blue-700 hover:text-white' : 'text-blue-600 border border-blue-600 hover:bg-blue-50'}`}
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
            className={`qr-popover w-72 h-auto ${themeClasses.cardBg} rounded-xl shadow-xl border ${themeClasses.borderColor} p-4`}
          >
            {console.log("QR Popover is rendering for index:", selectedResultIndex)} {/* CHECK 3: Is the popover rendering? */}
            {console.log("Upload Result for QR Code:", uploadResults[selectedResultIndex])} {/* CHECK 4: Log the upload result object */}
            <h3 className={`font-bold text-sm mb-2 ${themeClasses.textColor} truncate`}>{uploadResults[selectedResultIndex].fileName}</h3>

            <div className="flex justify-center mb-3">
              <QRCode
                value={uploadResults[selectedResultIndex].downloadLink}
                size={150}
                bgColor={darkMode ? '#2D3748' : "#ffffff"}
                fgColor="#000000"
                level="M"
              />
            </div>

            <div className={`mb-1 text-xs ${themeClasses.secondaryTextColor} font-medium`}>Download Link:</div>
            <div className={`p-2 ${themeClasses.dropZoneBg} rounded-lg mb-3 break-all text-xs ${themeClasses.textColor} max-h-16 overflow-y-auto`}>
              {uploadResults[selectedResultIndex].downloadLink}
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(uploadResults[selectedResultIndex].downloadLink, selectedResultIndex);
                }}
                className={`p-2 flex-1 rounded-lg flex items-center justify-center font-medium transition-colors text-xs ${themeClasses.buttonBg} ${themeClasses.textColor} ${themeClasses.buttonHoverBg}`}
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
                className={`rounded-lg border p-2 flex-1 flex items-center justify-center font-medium transition-colors text-xs ${themeClasses.borderColor} ${themeClasses.textColor} ${themeClasses.hoverBg} hover:${themeClasses.textColor}`}
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