const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const app = express();
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

app.use(cors()); // Enable cross-origin resource sharing (CORS), this allows one domain to access different domains
app.use('/uploads', express.static('uploads')); // Serve static files from 'uploads' directory
app.use(express.json()); // Enables JSON parsing for the request body, allowing you to access req.body and its properties

// Create a new instance of the Storage class
const storageGCS = new Storage({
    keyFilename: 'KEY-FILE.json',
});
const bucketName = 'segmented-volume-images'; // Replace with your GCS bucket name
const uploadDir = './uploads/'; // Destination directory to save downloaded images
const directoryPath = 'segmented_images/'; // Set the GCS directory path

// Configure Multer to store uploaded files on the file system
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/';
        fs.mkdirSync(uploadDir, { recursive: true }); // Create the "uploads" directory if it doesn't exist
        cb(null, uploadDir); // Store files in "uploads" directory
    },
    filename: function (req, file, cb) {
        cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname); // Generate a unique filename
    },
});

const upload = multer({ storage: storage });

function downloadFile(file) {
    return new Promise((resolve, reject) => {
        const filename = path.basename(file.name);
        const localPath = path.join(uploadDir, filename);
        const writeStream = fs.createWriteStream(localPath);

        file.createReadStream().pipe(writeStream);

        writeStream.on('finish', () => {
            console.log(`Image downloaded and saved to ${localPath}`);
            resolve();
        });

        writeStream.on('error', (err) => {
            console.error('Error while downloading the image:', err);
            reject(err);
        });
    });
}

// Define your API endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        // Prepare the data to send to the segmentation-volume API
        const filePath = req.file.path;

        const formData = new FormData();
        formData.append('img', fs.createReadStream(filePath), req.file.filename);

        const response1 = await axios.post('http://34.28.180.8/estimate_volume', formData, {
            headers: formData.getHeaders(),
        });
        console.log('Response from Volume-Segmentation API:');
        console.log(response1.data);

        // Prepare the data to send to the classification-nutritional_values API
        const response2 = await axios.post('http://104.198.208.219/predict', response1.data);
        console.log('Response from Classification-Nutritional Values API:');
        console.log(response2.data);

        // Get the GCS bucket
        const bucket = storageGCS.bucket(bucketName);

        bucket.getFiles({ prefix: directoryPath }, async (err, files) => {
            if (err) {
                console.error('Error while listing files in the GCS directory:', err);
                return;
            }

            await Promise.all(files.map(file => downloadFile(file)));

            // Send back the final response data from both servers to the client
            // After the promise is done. So we send a response only after all the files have been downloaded
            // List containing: 
            // _path to segmented image_, _volume_, _list: [label, nutritional values]_
            res.status(200).json(response2.data);
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error processing the request' });
    }

});

app.get('/api/images', (req, res) => {
    // Read the "uploads" directory and retrieve the list of filenames
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            console.error('Error reading files:', err);
            res.status(500).json({ message: 'Error reading files' });
        } else {
            res.status(200).json(files);
        }
    });
});

app.get('/api/deleteAll', async (req, res) => {
    const dirPath = path.join(__dirname, './uploads');

    const deleteLocalFiles = new Promise((resolve, reject) => {
        fs.rm(dirPath, { recursive: true }, (error) => {
            if (error) {
                console.error('Error while deleting directory.', error);
                reject('Error while deleting local directory.');
            } else {
                console.log('Directory deleted successfully.');
                resolve('Local directory deleted successfully.');
            }
        });
    });

    const deleteGCSFiles = storageGCS.bucket(bucketName)
        .getFiles({ prefix: directoryPath })
        .then(([files]) => {
            const deletePromises = files.map(file => file.delete());
            return Promise.all(deletePromises);
        })
        .then(() => {
            console.log('Files deleted successfully from GCS.');
            return 'Files deleted successfully from GCS.';
        })
        .catch((err) => {
            console.error('Error getting the files from GCS:', err);
            throw 'Error deleting files from GCS.';
        });

    Promise.all([deleteLocalFiles, deleteGCSFiles])
        .then(() => res.status(200).json({ message: 'All files and directories deleted successfully.' }))
        .catch((error) => res.status(500).json({ error: 'Internal server error', details: error }));
});

app.delete('/api/delete/:filename', async (req, res) => {
    const filename = req.params.filename;

    // Delete the file from local filesystem
    const localFilePath = path.join(uploadDir, filename);
    try {
        fs.unlinkSync(localFilePath);
    } catch (err) {
        console.error('Error deleting the local file:', err);
        return res.status(500).json({ success: false, message: 'Error deleting the local file' });
    }

    // Delete the file from Google Cloud Storage
    const gcsFilePath = `${directoryPath}${filename}`;
    const file = storageGCS.bucket(bucketName).file(gcsFilePath);
    try {
        await file.delete();
    } catch (err) {
        console.error('Error deleting the file from GCS:', err);
        return res.status(500).json({ success: false, message: 'Error deleting the file from GCS' });
    }

    res.json({ success: true });
});

app.post('/api/edit', async (req, res) => {
    const { newName, updatedData } = req.body;
    const editName = newName.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());

    if (!editName) {
        return res.status(400).json({ message: 'Missing new name' });
    }

    const end_pt_url = 'https://trackapi.nutritionix.com/v2/natural/nutrients';
    const HEADERS = {
        "Content-Type": "application/json",
        "x-app-id": "b663319a",
        "x-app-key": "09f02c8d76e65b2570d3d89b3e519b8d"
    };
    const query = {
        "query": editName,
    };

    try {
        const response = await axios.post(end_pt_url, query, { headers: HEADERS });
        const foods = response.data.foods;
        if (foods.length > 0) {
            const {
                food_name,
                serving_weight_grams,
                nf_calories,
                nf_total_fat,
                nf_cholesterol,
                nf_sodium,
                nf_total_carbohydrate,
                nf_sugars,
                nf_protein
            } = foods[0];

            const tmp = serving_weight_grams;
            const resultArray = [
                food_name,
                serving_weight_grams,
                nf_calories,
                nf_total_fat,
                nf_cholesterol,
                nf_sodium,
                nf_total_carbohydrate,
                nf_sugars,
                nf_protein
            ];

            for (let val = 2; val < resultArray.length; val++) {
                resultArray[val] = (parseFloat(resultArray[val]) / parseFloat(tmp)) * updatedData;
            }
            console.log('Edit results:');
            console.log(resultArray);

            res.status(200).json(resultArray);
        } else {
            res.status(404).json({ message: 'Food not found' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error processing the request' });
    }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
