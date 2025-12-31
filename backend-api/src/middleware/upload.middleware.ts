import multer from 'multer';

// Configure multer for CSV file uploads
export const csvUpload = multer({
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1 // Single file only
    },
    fileFilter: (_req, file, cb) => {
        // Check file extension
        if (file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});
