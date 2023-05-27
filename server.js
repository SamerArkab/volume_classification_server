const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const app = express();
const cors = require('cors');

app.use(cors()); // Enable cross-origin resource sharing (CORS), this allows one domain to access different domains

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

        const response1 = await axios.post('http://localhost:8080/estimate_volume', formData, {
            headers: formData.getHeaders(),
        });

        console.log(response1.data);

        // Prepare the data to send to the classification-nutritional_values API
        const response2 = await axios.post('http://localhost:8081/predict', response1.data);

        console.log(response2.data);

        // Send back the final response data from both servers to the client
        // List containing: 
        // _path to segmented image_, _volume_, _list: [label, nutritional values]_
        res.status(200).json(response2.data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error processing the request' });
    }

});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
