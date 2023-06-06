You can find more details about the models for classification, volume estimation, and segmentation [here](https://github.com/SamerArkab/Final_Proj_Volume_Classification)
You can find the client-side [here](https://github.com/SamerArkab/volume_classification_client)

# Nutritional Analysis Server

This repository contains the server side code for an application that estimates the volume of food in images, identifies the type of food, and provides a detailed nutritional analysis. The server is implemented in Node.js, with a series of API endpoints that handle image uploads, process them through machine learning models, and manage the lifecycle of the image files both locally and in Google Cloud Storage.

## Overview

The server code is organized around Express.js middleware and a series of endpoints for managing and processing uploaded images. In particular:

- CORS (Cross-Origin Resource Sharing) is enabled to allow for cross-domain access.
- The `/uploads` route serves static files from an 'uploads' directory.
- Google Cloud Storage is configured for storing and retrieving segmented images.
- Multer middleware is used for handling `multipart/form-data`, primarily used for file uploads.
- Endpoints are provided for uploading images, retrieving processing results, retrieving and deleting files, and editing data.

## Usage

You can start the server locally by running `node server.js`, assuming you've installed all the necessary dependencies (`npm install`). The server will start on port 5000, or on the port specified by the `PORT` environment variable.
It is also hosted on a GCP VM, so you can access it using the client-side without running the server on your local machine.
* I don't keep the models running idly on Google Kubernetes Engine to save on costs.

### Endpoints

- `POST /api/upload`: Accepts an image file for upload and processing.
- `GET /api/result/:requestId`: Returns the result of processing the image associated with the given request ID.
- `GET /api/images`: Returns a list of all files in the 'uploads' directory.
- `GET /api/deleteAll`: Deletes all files in the 'uploads' directory and in the Google Cloud Storage directory.
- `DELETE /api/delete/:filename`: Deletes the specified file from the 'uploads' directory and from the Google Cloud Storage.
- `POST /api/edit`: Accepts a new name and updated data, and returns modified nutritional information.

## Dependencies

- Node.js and npm
- Express.js for server routing.
- Multer for handling file uploads.
- Google Cloud Storage for storing and retrieving images.
- Axios for making HTTP requests.
- Cors for enabling CORS.
- dotenv for environment variable management.
