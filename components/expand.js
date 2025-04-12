"use client"

import { useState, useRef, useEffect } from "react"
import QRCode from "react-qr-code"
import {
    FaCloudUploadAlt, FaCheckCircle, FaClipboardCheck,
    FaExternalLinkAlt, FaTrashAlt, FaStar, FaRegStar,
    FaMoon, FaSun, FaShareAlt, FaFilter, FaChevronDown, FaChevronUp
} from "react-icons/fa"
import { MdError, MdInfo } from "react-icons/md"
import { motion, AnimatePresence } from "framer-motion"

// Helper Function to safely get the File object
const getFileObject = (item) => item?.fileRef || item;

// Helper function to format file size
const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
        return 'N/A'; // Handle invalid size gracefully
    }
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FileUpload = () => {
    // State Variables (mostly unchanged)
    const [files, setFiles] = useState([]) // Array can contain File objects or { fileRef: File, preview: ..., ... }
    const [uploadResults, setUploadResults] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState(null)
    const fileInputRef = useRef(null)
    const [copySuccess, setCopySuccess] = useState(null)
    const [selectedResultIndex, setSelectedResultIndex] = useState(null)
    const [showUploadForm, setShowUploadForm] = useState(true)
    const [darkMode, setDarkMode] = useState(false)
    const [favorites, setFavorites] = useState([])
    const [filterFavorites, setFilterFavorites] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({})
    const [showFilePreviews, setShowFilePreviews] = useState(true) // Kept for potential future use
    const dragCounter = useRef(0)
    const [isDragging, setIsDragging] = useState(false)
    const [uploadComplete, setUploadComplete] = useState(false);

    // --- Load/Save useEffect hooks ---
    useEffect(() => {
        let savedResults = null;
        try {
             savedResults = localStorage.getItem('uploadResults');
             if (savedResults) setUploadResults(JSON.parse(savedResults));
        } catch (e) {
            console.error("Failed to parse saved results:", e);
            localStorage.removeItem('uploadResults'); // Clear corrupted data
        }

        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode) setDarkMode(savedDarkMode === 'true');

        try {
            const savedFavorites = localStorage.getItem('favorites');
            if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        } catch (e) {
            console.error("Failed to parse saved favorites:", e);
            localStorage.removeItem('favorites'); // Clear corrupted data
        }


        // Restore form visibility state only if there are results
        const savedShowUploadForm = localStorage.getItem('showUploadForm');
        if (savedShowUploadForm && savedResults) {
            setShowUploadForm(savedShowUploadForm === 'true');
        } else {
            setShowUploadForm(true); // Default to show form if no results or no saved state
        }
    }, []);

    useEffect(() => {
        // Only save if there are results to avoid empty array overwriting
        if (uploadResults.length > 0) {
          try {
              localStorage.setItem('uploadResults', JSON.stringify(uploadResults));
              // Save the form visibility state only when results exist
               localStorage.setItem('showUploadForm', showUploadForm.toString());
          } catch (e) {
             console.error("Failed to save results:", e);
          }
        } else {
          // Clear storage if results are empty
          localStorage.removeItem('uploadResults');
          localStorage.removeItem('showUploadForm');
        }

        localStorage.setItem('darkMode', darkMode.toString());

        if (favorites.length > 0) {
           try {
               localStorage.setItem('favorites', JSON.stringify(favorites));
           } catch (e) {
               console.error("Failed to save favorites:", e);
           }
        } else {
          localStorage.removeItem('favorites');
        }
      }, [uploadResults, darkMode, favorites, showUploadForm]);

    // --- File Handling with Wrapper Objects for Images ---
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          // Add the raw File objects first
          setFiles(prevFiles => [...prevFiles, ...newFiles]);
          setUploadError(null);

          // Process previews asynchronously
          newFiles.forEach((file) => {
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (event) => {
                // Update state immutably: map and replace the specific File object
                // with a wrapper object containing the preview and a reference
                setFiles(currentFiles => currentFiles.map(f =>
                    // Use object reference equality to find the file we just added
                    f === file
                    ? {
                        fileRef: f, // Keep the original File object reference
                        preview: event.target.result,
                        // Copy essential display properties (optional but good practice)
                        name: f.name,
                        size: f.size,
                        type: f.type,
                        lastModified: f.lastModified, // Useful for keys
                      }
                    : f // Return other items unchanged
                ));
              };
              reader.onerror = (error) => {
                 console.error("FileReader error: ", error);
                 // Optional: Update state to show preview failed for this file
                 setFiles(currentFiles => currentFiles.map(f =>
                    f === file ? { ...f, previewError: true } : f
                 ));
              };
              reader.readAsDataURL(file);
            }
            // No 'else' needed: non-images remain as File objects in the state
          });
          // Clear the input value to allow selecting the same file again
          if(fileInputRef.current) fileInputRef.current.value = "";
        }
      };

    const removeFile = (index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
        // If removing the last file, clear any lingering upload error
        if (files.length === 1) {
            setUploadError(null);
        }
    };

    const getFileIcon = (fileType) => {
        if (!fileType) return '📁';
        if (fileType.includes('image')) return '🖼️';
        if (fileType.includes('video')) return '🎬';
        if (fileType.includes('audio')) return '🎵';
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('zip') || fileType.includes('rar')) return '🗜️';
        return '📁';
    };

    // --- Upload Logic ---
    const handleUpload = async () => {
        if (files.length === 0) {
          setUploadError("Please select at least one file!");
          return;
        }
        setUploadError(null);
        setUploading(true);
        setSelectedResultIndex(null); // Close any open item

        // Initialize progress
        const initialProgress = {};
        files.forEach((_, index) => {
          initialProgress[index] = 0;
        });
        setUploadProgress(initialProgress);

        let results = []; // Define results array outside try block

        try {
          for (let i = 0; i < files.length; i++) {
            const fileOrWrapper = files[i];
            const fileToUpload = getFileObject(fileOrWrapper); // Get the actual File object

            // ** Crucial Validation **
            if (!(fileToUpload instanceof File)) {
              console.error(`Item at index ${i} is not a valid File object:`, fileOrWrapper);
              results.push({
                fileName: fileOrWrapper?.name || `Invalid item at index ${i}`,
                fileType: fileOrWrapper?.type,
                fileSize: undefined, // Mark size as unavailable
                success: false,
                error: "Invalid file data",
                timestamp: new Date().toISOString()
              });
              setUploadProgress(prev => ({ ...prev, [i]: 100 })); // Mark as complete (failed)
              continue; // Skip to next file
            }

            // ** Validate File Size (Example: Limit to 100MB) **
            const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
            if (fileToUpload.size > MAX_SIZE) {
                 results.push({
                    fileName: fileToUpload.name,
                    fileType: fileToUpload.type,
                    fileSize: fileToUpload.size,
                    success: false,
                    error: `File exceeds ${formatFileSize(MAX_SIZE)} limit`,
                    timestamp: new Date().toISOString()
                 });
                 setUploadProgress(prev => ({ ...prev, [i]: 100 })); // Mark as complete (failed)
                 continue; // Skip
            }
            if (fileToUpload.size === 0) {
                results.push({
                   fileName: fileToUpload.name,
                   fileType: fileToUpload.type,
                   fileSize: 0,
                   success: false,
                   error: `File is empty`,
                   timestamp: new Date().toISOString()
                });
                setUploadProgress(prev => ({ ...prev, [i]: 100 })); // Mark as complete (failed)
                continue; // Skip
           }


            const formData = new FormData();
            formData.append("file", fileToUpload, fileToUpload.name); // Append the actual File

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(prev => ({ ...prev, [i]: percentComplete }));
              }
            });

            const uploadPromise = new Promise((resolve, reject) => {
              xhr.open('POST', '/api/bunkr_upload', true); // Ensure endpoint is correct
              xhr.timeout = 300000; // 5 minutes timeout for example

              xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const data = JSON.parse(xhr.responseText);
                    // ** Check for expected data structure **
                    if (data && data.downloadLink) {
                       resolve(data);
                    } else {
                       console.error("API Success Response missing downloadLink:", data);
                       reject(new Error("Upload succeeded but response format is invalid."));
                    }
                  } catch (e) {
                    console.error("Failed to parse success response:", xhr.responseText, e);
                    reject(new Error("Invalid response format from server."));
                  }
                } else {
                  // Attempt to parse error message from API
                  let errorMsg = `Upload failed: Status ${xhr.status}`;
                  try {
                     const errorData = JSON.parse(xhr.responseText);
                     errorMsg = errorData.error || errorData.message || errorMsg; // Use API error if available
                     // Specific check for common issues like 'Bad Request'
                     if (xhr.status === 400) errorMsg = `Bad Request: ${errorMsg}`;

                  } catch (e) { /* Ignore parsing error, use default status message */ }
                  console.error("API Upload Error:", errorMsg, xhr.responseText);
                  reject(new Error(errorMsg)); // Reject with the error message
                }
              };

              xhr.onerror = function () {
                 console.error("Network error during upload");
                reject(new Error("Network error during upload. Check connection."));
              };
              xhr.ontimeout = function () {
                 console.error("Upload timed out");
                 reject(new Error("Upload timed out. Please try again."));
              };


              xhr.send(formData);
            });

            try {
              const data = await uploadPromise;
              results.push({
                fileName: fileToUpload.name,
                fileType: fileToUpload.type,
                fileSize: fileToUpload.size, // Use size from the actual file object
                success: true,
                downloadLink: data.downloadLink,
                timestamp: new Date().toISOString(),
                favorite: false
              });
            } catch (error) {
              console.error(`Upload failed for ${fileToUpload.name}:`, error);
              results.push({
                fileName: fileToUpload.name,
                fileType: fileToUpload.type,
                fileSize: fileToUpload.size, // Still record size if possible
                success: false,
                error: error.message || "Upload failed", // Use error message from reject
                timestamp: new Date().toISOString()
              });
            }
          } // End of for loop

          // Add new results to the beginning of the list
          setUploadResults(prevResults => [...results, ...prevResults]);

          const allFailed = results.every(result => !result.success);
          const someFailed = results.some(result => !result.success);
          if (allFailed && files.length > 0) {
              setUploadError("All file uploads failed. Please check files or try again.");
          } else if (someFailed) {
              setUploadError("Some files failed to upload."); // Less severe message
          }

        } catch (error) { // Catch errors occurring outside the loop/promise logic
          console.error("Unhandled frontend upload error:", error);
          setUploadError("An unexpected error occurred during upload.");
        } finally {
          setUploading(false);
          setFiles([]); // Clear the selection (wrappers and files)
          setUploadProgress({}); // Clear progress indicators
          if (results.length > 0) { // Only trigger form hide if uploads were attempted
              setUploadComplete(true);
          }
        }
      };

    // --- useEffect for uploadComplete ---
    useEffect(() => {
        if (uploadComplete) {
            // Hide form if there was at least one upload attempt (success or fail)
            if (uploadResults.length > 0) {
                setShowUploadForm(false);
            }
            setUploadComplete(false); // Reset trigger
        }
    }, [uploadComplete, uploadResults]); // Depends on both

    // --- UI Event Handlers ---
    const handleChooseFileClick = () => {
        if (!uploading) { // Prevent opening dialog while uploading
            fileInputRef.current?.click();
        }
    };

    const handleCopyLink = (link, index, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(link)
            .then(() => setCopySuccess(index))
            .catch(err => console.error('Failed to copy!', err));
        setTimeout(() => setCopySuccess(null), 1500);
    };

    const handleReset = () => {
        setFiles([]);
        setUploadError(null);
        setShowUploadForm(true);
        setSelectedResultIndex(null); // Close any expanded item
        setUploadProgress({});
    };

    const handleFileSelect = (index) => {
        setSelectedResultIndex(prevIndex => (prevIndex === index ? null : index));
    };

    const toggleFavorite = (index, e) => {
        e.stopPropagation();
        const result = filteredResults[index]; // Use filteredResults index
        if (!result || !result.success) return; // Can only favorite successful uploads

        // Find the actual index in the main uploadResults array
        const actualIndex = uploadResults.findIndex(r => r.timestamp === result.timestamp && r.fileName === result.fileName);
        if (actualIndex === -1) return;


        const newUploadResults = [...uploadResults];
        const targetResult = newUploadResults[actualIndex];
        targetResult.favorite = !targetResult.favorite;
        setUploadResults(newUploadResults);

        // Update derived favorites state
        if (targetResult.favorite) {
            setFavorites(prev => [...prev, targetResult.downloadLink].filter(Boolean));
        } else {
            setFavorites(prev => prev.filter(link => link !== targetResult.downloadLink));
        }
    };

    const deleteUploadResult = (index, e) => {
        e.stopPropagation();
        const resultToDelete = filteredResults[index]; // Use filteredResults index
        if (!resultToDelete) return;

        // Find the actual index in the main uploadResults array to remove it
        const actualIndex = uploadResults.findIndex(r => r.timestamp === resultToDelete.timestamp && r.fileName === resultToDelete.fileName);
        if (actualIndex === -1) return;


        // If it was a favorite, remove from favorites list as well
        if (resultToDelete.favorite && resultToDelete.downloadLink) {
            setFavorites(prev => prev.filter(link => link !== resultToDelete.downloadLink));
        }

        // Filter out the item from the main list
        const newUploadResults = uploadResults.filter((_, i) => i !== actualIndex);
        setUploadResults(newUploadResults);

        // Adjust selected index if necessary (relative to the *filtered* list before deletion)
        if (selectedResultIndex === index) {
            setSelectedResultIndex(null);
        }
        // No need to decrement selectedResultIndex here, as filtering handles it implicitly
    };

    const toggleDarkMode = () => setDarkMode(!darkMode);
    const toggleFilterFavorites = () => {
        setFilterFavorites(!filterFavorites);
        setSelectedResultIndex(null); // Close item when filter changes
    };

    // --- Theme Classes ---
    const themeClasses = {
        mainBg: darkMode ? "bg-gray-900" : "bg-gray-50", // Light gray for light mode main bg
        textColor: darkMode ? "text-gray-200" : "text-gray-800",
        secondaryTextColor: darkMode ? "text-gray-400" : "text-gray-500", // Slightly adjusted
        cardBg: darkMode ? "bg-gray-800" : "bg-white",
        borderColor: darkMode ? "border-gray-700" : "border-gray-200",
        hoverBg: darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100", // Lighter hover for light mode
        dropZoneBg: darkMode ? "bg-gray-800 border-gray-600" : "bg-blue-50 border-blue-300",
        dropZoneBorder: darkMode ? "border-blue-600" : "border-blue-300",
        dropZoneActiveBg: darkMode ? "bg-blue-900 bg-opacity-50 border-blue-400" : "bg-blue-100 border-blue-500",
        dropZoneActiveBorder: darkMode ? "border-blue-400" : "border-blue-500",
        buttonBg: darkMode ? "bg-blue-700" : "bg-blue-600",
        buttonHoverBg: darkMode ? "hover:bg-blue-800" : "hover:bg-blue-700",
        buttonDisabledBg: darkMode ? "bg-gray-600" : "bg-gray-400",
        successBg: darkMode ? "bg-green-900 bg-opacity-50 border-green-700" : "bg-green-50 border-green-300", // Added border
        successText: darkMode ? "text-green-400" : "text-green-700",
        errorBg: darkMode ? "bg-red-900 bg-opacity-50 border-red-700" : "bg-red-100 border-red-300", // Added border
        errorText: darkMode ? "text-red-400" : "text-red-600", // Darker red for light mode
        expandedBg: darkMode ? "bg-gray-750" : "bg-gray-50", // Subtle difference for expansion
    };

    // --- Drag and Drop Handlers ---
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Necessary to allow drop
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const droppedFiles = Array.from(e.dataTransfer.files);
          // Add raw File objects first
          setFiles(prevFiles => [...prevFiles, ...droppedFiles]);
          setUploadError(null);

          // Process previews asynchronously (same logic as handleFileChange)
          droppedFiles.forEach((file) => {
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (event) => {
                setFiles(currentFiles => currentFiles.map(f =>
                    f === file
                    ? { fileRef: f, preview: event.target.result, name: f.name, size: f.size, type: f.type, lastModified: f.lastModified }
                    : f
                ));
              };
              reader.onerror = (error) => {
                  console.error("FileReader error: ", error);
                  setFiles(currentFiles => currentFiles.map(f =>
                    f === file ? { ...f, previewError: true } : f
                 ));
              };
              reader.readAsDataURL(file);
            }
          });
          e.dataTransfer.clearData();
        }
    };

    // --- Derived State ---
    const filteredResults = filterFavorites
        ? uploadResults.filter(result => result.favorite && result.success) // Only favorite successful uploads
        : uploadResults;

    // --- Bulk Actions ---
    const clearAllResults = () => {
        if (confirm("Are you sure you want to clear all upload history? This cannot be undone.")) {
          setUploadResults([]);
          setFavorites([]);
          localStorage.removeItem('uploadResults');
          localStorage.removeItem('favorites');
          localStorage.removeItem('showUploadForm');
          setSelectedResultIndex(null);
          setShowUploadForm(true); // Show form after clearing
        }
    };

    const downloadAllLinks = () => {
        const links = uploadResults
          .filter(result => result.success && result.downloadLink)
          .map(result => `${result.fileName}: ${result.downloadLink}`) // Include filename
          .join('\n');

        if (!links) {
          alert("No downloadable links found in history.");
          return;
        }

        const element = document.createElement('a');
        const file = new Blob([links], { type: 'text/plain;charset=utf-8' }); // Specify charset
        element.href = URL.createObjectURL(file);
        element.download = `bunkr-upload-links-${new Date().toISOString().split('T')[0]}.txt`; // Add date to filename
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href); // Clean up blob URL
    };


    // --- JSX Structure ---
    return (
        <div
            className={`w-full max-w-3xl mx-auto relative ${themeClasses.mainBg} p-4 sm:p-6 rounded-xl transition-colors duration-300 shadow-lg`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-30 border-4 border-blue-500 border-dashed rounded-xl flex items-center justify-center z-50 pointer-events-none">
                    <div className="text-center p-6 rounded-lg bg-white bg-opacity-95 shadow-xl">
                        <FaCloudUploadAlt className="text-6xl text-blue-600 mx-auto mb-4 animate-bounce" />
                        <p className="text-xl font-semibold text-gray-800">Drop files anywhere!</p>
                    </div>
                </div>
            )}

            {/* Theme Toggle and Actions Bar */}
            <div className="flex justify-between items-center mb-4 sm:mb-6">
                <button
                    onClick={toggleDarkMode}
                    title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    {darkMode ? <FaSun size={16}/> : <FaMoon size={16}/>}
                </button>

                <div className="flex items-center space-x-2">
                    {uploadResults.length > 0 && (
                        <>
                            <button
                                onClick={toggleFilterFavorites}
                                title={filterFavorites ? "Show All Files" : "Show Only Favorites"}
                                className={`p-2 rounded-lg text-xs font-medium flex items-center transition-colors ${
                                filterFavorites
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    : `${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
                                }`}
                            >
                                {filterFavorites ? <FaStar className="mr-1" size={12} /> : <FaFilter className="mr-1" size={12}/>}
                                <span className="hidden sm:inline">{filterFavorites ? 'Favorites' : 'Filter'}</span>
                            </button>

                            <button
                                onClick={downloadAllLinks}
                                title="Export All Links"
                                className={`p-2 rounded-lg text-xs font-medium flex items-center transition-colors ${
                                darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                <FaShareAlt className="mr-1" size={12} />
                                <span className="hidden sm:inline">Export</span>
                            </button>

                            <button
                                onClick={clearAllResults}
                                title="Clear All History"
                                className={`p-2 rounded-lg text-xs font-medium flex items-center transition-colors ${
                                darkMode ? 'bg-red-800 text-red-300 hover:bg-red-700' : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                            >
                                <FaTrashAlt className="mr-1" size={12} />
                                <span className="hidden sm:inline">Clear All</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Card Content */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`w-full p-4 sm:p-5 border rounded-xl shadow-md ${themeClasses.cardBg} ${themeClasses.borderColor}`}
            >
                {/* Header */}
                <div className="flex items-center justify-center mb-2 text-center">
                    <span className="text-blue-500 mr-2 text-2xl flex-shrink-0"><FaCloudUploadAlt /></span>
                    <h2 className={`text-xl font-bold ${themeClasses.textColor}`}>Multi-File Uploader</h2>
                </div>
                <p className={`text-center mb-4 text-xs ${themeClasses.secondaryTextColor}`}>
                    Drag & drop or select files. Get shareable links & QR codes.
                </p>

                {/* Success/Info message after upload */}
                {uploadResults.length > 0 && !showUploadForm && (
                    <div className="mb-4">
                        <div className={`py-2 px-3 rounded-lg ${themeClasses.successBg} text-center border`}>
                        <p className={`font-semibold ${themeClasses.successText} flex items-center justify-center text-sm`}>
                            <FaCheckCircle className="mr-2" />
                            {uploadResults.filter(r => r.success).length > 0
                                ? `${uploadResults.filter(r => r.success).length} file${uploadResults.filter(r => r.success).length !== 1 ? 's' : ''} ready!`
                                : "Uploads processed." // Message if all failed but history shown
                            }
                        </p>
                        {uploadResults.filter(r => !r.success).length > 0 && (
                             <p className={`text-xs ${themeClasses.errorText} mt-1 flex items-center justify-center`}>
                                <MdError className="mr-1" />
                                {uploadResults.filter(r => !r.success).length} file{uploadResults.filter(r => !r.success).length !== 1 ? 's' : ''} failed.
                             </p>
                        )}
                        <p className={`text-xs ${themeClasses.secondaryTextColor} mt-1 flex items-center justify-center`}>
                            <MdInfo className="mr-1" /> Click on a file below to see details.
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
                    accept="image/*,video/*,audio/*,application/pdf,.zip,.rar" // Example: Limit accepted types
                />

                {/* Upload Form Section (Conditional) */}
                <AnimatePresence mode="wait">
                    {showUploadForm && (
                        <motion.div
                            key="upload-form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                        >
                            {/* Drop Zone / File Select */}
                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                className={`relative w-full py-5 px-4 text-center rounded-lg border-2 border-dashed mb-3 transition-colors duration-200 cursor-pointer
                                    ${isDragging ? themeClasses.dropZoneActiveBg : files.length > 0 ? `border-green-500 ${darkMode ? 'bg-green-900 bg-opacity-30' : 'bg-green-50'}` : themeClasses.dropZoneBg}
                                    hover:border-blue-500`}
                                onClick={handleChooseFileClick}
                            >
                                <FaCloudUploadAlt className={`mx-auto text-4xl mb-2 transition-colors ${files.length > 0 ? "text-green-600" : isDragging ? "text-blue-400" : "text-blue-500"}`} />
                                <span className={`font-medium text-sm ${themeClasses.textColor}`}>
                                {isDragging ? "Drop files here!" : files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` : "Click or Drag Files Here"}
                                </span>
                                <p className={`text-xs ${themeClasses.secondaryTextColor} mt-1`}>Select files to upload</p>
                            </motion.div>

                             {/* File Previews and List */}
                             {files.length > 0 && (
                                <div className="mb-3">
                                    {/* Preview Grid */}
                                    {showFilePreviews && files.some(f => f.preview) && (
                                        <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {files.map((fileOrWrapper, index) => {
                                            const fileObj = getFileObject(fileOrWrapper);
                                            const preview = fileOrWrapper.preview;
                                            if (!preview) return null;
                                            const key = `preview-grid-${fileObj.name}-${fileObj.lastModified}-${index}`;

                                            return (
                                                <div key={key} className="relative group aspect-square">
                                                    <img src={preview} alt={fileObj.name} className="w-full h-full object-cover rounded-md border border-gray-300 dark:border-gray-600"/>
                                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center rounded-md">
                                                    <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} title={`Remove ${fileObj.name}`} className="text-white opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 rounded-full p-1 transition-all scale-75 group-hover:scale-100">
                                                        <FaTrashAlt size={10} />
                                                    </button>
                                                    </div>
                                                     {fileOrWrapper.previewError && <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center text-white text-xs font-bold">Error</div>}
                                                </div>
                                            );
                                        })}
                                        </div>
                                    )}

                                    {/* File List */}
                                    <div className={`border rounded-lg overflow-hidden ${themeClasses.borderColor}`}>
                                        <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} py-2 px-3 border-b ${themeClasses.borderColor} font-medium ${themeClasses.textColor} text-sm flex justify-between items-center`}>
                                            <span>Ready to Upload ({files.length})</span>
                                        </div>
                                        <div className={`max-h-48 overflow-y-auto ${themeClasses.cardBg}`}>
                                            <AnimatePresence>
                                                {files.map((fileOrWrapper, index) => {
                                                    const fileObj = getFileObject(fileOrWrapper);
                                                    const preview = fileOrWrapper.preview;
                                                    const key = `list-${fileObj.name}-${fileObj.lastModified}-${index}`;

                                                    return (
                                                        <motion.div
                                                            key={key} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                                            className={`py-2 px-3 border-b ${themeClasses.borderColor} last:border-b-0 flex items-center justify-between ${themeClasses.hoverBg}`}
                                                        >
                                                            <div className="flex items-center min-w-0 flex-1 mr-2">
                                                                {preview ? (<img src={preview} alt="p" className="w-6 h-6 mr-2 object-cover rounded flex-shrink-0"/>)
                                                                    : (<span className="text-lg mr-2 flex-shrink-0">{getFileIcon(fileObj.type)}</span>)
                                                                }
                                                                <div className="overflow-hidden flex-1">
                                                                    <p className={`font-medium ${themeClasses.textColor} truncate text-sm`}>{fileObj.name}</p>
                                                                    <p className={`text-xs ${themeClasses.secondaryTextColor}`}>{formatFileSize(fileObj.size)}</p>
                                                                </div>
                                                            </div>
                                                            {uploadProgress[index] !== undefined && uploadProgress[index] < 100 && !uploading && (
                                                                <div className="text-xs text-gray-400 font-medium">Queued</div>
                                                            )}
                                                             {uploading && uploadProgress[index] !== undefined && uploadProgress[index] < 100 && (
                                                                <div className="text-xs text-blue-500 font-medium">{uploadProgress[index]}%</div>
                                                             )}
                                                            <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} title={`Remove ${fileObj.name}`} className={`text-gray-500 hover:text-red-500 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex-shrink-0 ml-2 ${uploading ? 'hidden' : ''}`} >
                                                                <FaTrashAlt size={14} />
                                                            </button>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                             )}


                            {/* Error Message */}
                            <AnimatePresence>
                                {uploadError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className={`mb-3 p-2 rounded-md ${themeClasses.errorBg} border ${themeClasses.errorText} flex items-start text-sm`} // items-start for long messages
                                    >
                                        <MdError className="mr-2 flex-shrink-0 mt-0.5" size={18}/>
                                        <span>{uploadError}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Upload Button & Overall Progress */}
                            <div className="mt-1">
                                {uploading && files.length > 0 && (
                                    <div className="mb-2">
                                        <div className="h-2 w-full bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden relative">
                                            <motion.div
                                                className="h-full bg-blue-600 rounded-full absolute top-0 left-0"
                                                initial={{ width: '0%' }}
                                                animate={{ width: `${Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Math.max(files.length, 1)}%` }} // Avoid division by zero
                                                transition={{ duration: 0.2, ease: "linear" }}
                                            ></motion.div>
                                        </div>
                                        <p className="text-xs text-center mt-1 text-gray-500 dark:text-gray-400">
                                            Uploading {files.length} file{files.length !== 1 ? 's' : ''}... {Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Math.max(files.length, 1))}%
                                        </p>
                                    </div>
                                )}
                                <motion.button
                                    whileHover={{ scale: files.length > 0 && !uploading ? 1.02 : 1 }}
                                    whileTap={{ scale: files.length > 0 && !uploading ? 0.98 : 1 }}
                                    onClick={handleUpload}
                                    disabled={uploading || files.length === 0}
                                    className={`w-full py-2.5 px-4 rounded-lg text-white font-semibold transition-all duration-200 text-sm flex items-center justify-center ${ uploading || files.length === 0 ? themeClasses.buttonDisabledBg + " cursor-not-allowed" : themeClasses.buttonBg + " " + themeClasses.buttonHoverBg + " shadow-md hover:shadow-lg"}`}
                                >
                                    {uploading ? (
                                        <>
                                        <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Processing...</span>
                                        </>
                                    ) : ( `Upload ${files.length > 0 ? files.length : ''} File${files.length !== 1 ? 's' : ''}` )}
                                </motion.button>
                            </div>
                        </motion.div> // End of upload form motion div
                    )}
                </AnimatePresence>

                {/* Upload Results Section */}
                <AnimatePresence mode="wait">
                    {!showUploadForm && filteredResults.length > 0 && (
                         <motion.div
                            key="results-list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className={'mt-0'} // No top margin when form is hidden
                        >
                            <div className={`border rounded-lg overflow-hidden ${themeClasses.borderColor}`}>
                                {/* Header */}
                                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} py-2 px-3 border-b ${themeClasses.borderColor} font-medium ${themeClasses.textColor} text-sm flex items-center justify-between`}>
                                    <span>{filterFavorites ? 'Favorite Files' : 'Upload History'} ({filteredResults.length})</span>
                                </div>

                                {/* Results List */}
                                <div className={`max-h-[50vh] overflow-y-auto ${themeClasses.cardBg}`}>
                                    {filteredResults.map((result, index) => {
                                        // Use a stable key combining timestamp and filename if available
                                        const key = `result-${result.timestamp || index}-${result.fileName || index}`;
                                        const isExpanded = selectedResultIndex === index;

                                        return (
                                            <div key={key} className={`border-b last:border-b-0 ${themeClasses.borderColor}`}>
                                                {/* Clickable Row */}
                                                <motion.div
                                                    layout="position" // Animate layout changes smoothly
                                                    className={`py-2.5 px-3 ${themeClasses.hoverBg} cursor-pointer flex items-center justify-between transition-colors duration-150 ${isExpanded ? darkMode? 'bg-gray-750': 'bg-gray-50' : ''}`}
                                                    onClick={() => handleFileSelect(index)}
                                                    title={isExpanded ? "Hide Details" : "Show Details"}
                                                >
                                                    {/* File Info */}
                                                    <div className="flex items-center min-w-0 flex-1 mr-2">
                                                        <span className={`text-lg mr-2 flex-shrink-0 ${result.success ? '' : 'opacity-50'}`}>{getFileIcon(result.fileType)}</span>
                                                        <div className="overflow-hidden flex-1">
                                                            <span className={`font-medium ${themeClasses.textColor} truncate block text-sm ${result.success ? '' : 'line-through ' + themeClasses.secondaryTextColor}`}>{result.fileName}</span>
                                                            <p className={`text-xs ${themeClasses.secondaryTextColor}`}>
                                                                {result.success ? formatFileSize(result.fileSize) : 'Failed'}
                                                                {' • '}
                                                                {result.timestamp ? new Date(result.timestamp).toLocaleDateString() : ''}
                                                            </p>
                                                            {!result.success && result.error && (
                                                                <p className={`text-xs ${themeClasses.errorText} mt-0.5 truncate`} title={result.error}>Error: {result.error}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Action Buttons */}
                                                    <div className="flex items-center flex-shrink-0 space-x-1 ml-2">
                                                        <span className={`p-1 rounded-full ${themeClasses.secondaryTextColor} transition-transform ${isExpanded ? 'rotate-180': ''}`}><FaChevronDown size={12}/></span>
                                                        {result.success && (
                                                        <button onClick={(e) => toggleFavorite(index, e)} title={result.favorite ? "Unfavorite" : "Favorite"} className={`p-1.5 rounded-full transition-colors ${result.favorite ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-500/10'}`}>
                                                            {result.favorite ? <FaStar size={14} /> : <FaRegStar size={14} />}
                                                        </button>
                                                        )}
                                                        <button onClick={(e) => deleteUploadResult(index, e)} title="Delete entry" className="text-gray-500 hover:text-red-500 p-1.5 rounded-full hover:bg-red-500/10 transition-colors">
                                                            <FaTrashAlt size={14} />
                                                        </button>
                                                    </div>
                                                </motion.div>

                                                {/* Inline Expanded Details Section */}
                                                <AnimatePresence>
                                                    {isExpanded && result.success && result.downloadLink && (
                                                        <motion.div
                                                            key={`details-${key}`}
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.25, ease: "easeInOut" }}
                                                            className={`overflow-hidden px-3 pt-3 pb-4 ${themeClasses.expandedBg} border-t ${themeClasses.borderColor}`}
                                                        >
                                                            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start">
                                                                {/* QR Code */}
                                                                <div className="flex-shrink-0 p-1.5 bg-white rounded-md border border-gray-300 shadow-sm">
                                                                    <QRCode value={result.downloadLink} size={90} level="M" bgColor="#FFFFFF" fgColor="#000000"/>
                                                                </div>
                                                                {/* Link and Actions */}
                                                                <div className="flex-grow w-full min-w-0"> {/* Ensure flex item can shrink */}
                                                                    <div className={`mb-1.5 text-xs ${themeClasses.secondaryTextColor} font-medium`}>Download Link:</div>
                                                                    <div className={`p-2 ${darkMode ? 'bg-gray-800' : 'bg-white'} border ${themeClasses.borderColor} rounded-lg mb-3 break-words text-xs ${themeClasses.textColor} max-h-16 overflow-y-auto text-left`}>
                                                                        {result.downloadLink}
                                                                    </div>
                                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                                        <button onClick={(e) => handleCopyLink(result.downloadLink, index, e)} className={`py-1.5 px-3 w-full sm:w-auto flex-1 rounded-lg flex items-center justify-center font-medium transition-colors text-xs ${themeClasses.buttonBg} text-white ${themeClasses.buttonHoverBg}`}>
                                                                            {copySuccess === index ? (<><FaClipboardCheck className="mr-1.5" /> Copied!</>) : (<><FaClipboardCheck className="mr-1.5" /> Copy Link</>)}
                                                                        </button>
                                                                        <a href={result.downloadLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`py-1.5 px-3 w-full sm:w-auto flex-1 rounded-lg border flex items-center justify-center font-medium transition-colors text-xs ${themeClasses.borderColor} ${themeClasses.textColor} ${themeClasses.hoverBg} hover:${themeClasses.textColor}`}>
                                                                            <FaExternalLinkAlt className="mr-1.5" size={11} /> Open Link
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div> // End result item container
                                        );
                                    })}
                                </div> {/* End results list container */}
                            </div> {/* End results border wrapper */}

                             {/* "Upload More" Button */}
                            <motion.button
                                layout
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleReset}
                                className={`mt-4 w-full py-2 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${darkMode ? 'text-blue-300 border border-blue-700 hover:bg-blue-900 hover:text-white' : 'text-blue-600 border border-blue-600 hover:bg-blue-50'}`}
                            >
                                Upload More Files
                            </motion.button>
                        </motion.div> // End results section motion div
                    )}
                </AnimatePresence>

                 {/* Message when history is empty or filtered to empty */}
                 {!showUploadForm && filteredResults.length === 0 && (
                     <motion.div
                        key="no-results"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-center py-6"
                     >
                         <p className={`${themeClasses.secondaryTextColor} mb-4`}>
                            {filterFavorites ? "You haven't favorited any files yet." : "No upload history yet."}
                         </p>
                          <motion.button
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleReset}
                                className={`w-auto inline-block py-2 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${darkMode ? 'text-blue-300 border border-blue-700 hover:bg-blue-900 hover:text-white' : 'text-blue-600 border border-blue-600 hover:bg-blue-50'}`}
                            >
                                Start Uploading
                            </motion.button>
                     </motion.div>
                 )}


            </motion.div> {/* End of main card content div */}
        </div> // End of main component div
    );
};

export default FileUpload;