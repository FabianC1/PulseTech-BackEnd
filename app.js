// Import necessary dependencies
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const propertiesReader = require("properties-reader");

const app = express();

// Enable CORS
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Read properties from db.properties
const propertiesPath = path.resolve(__dirname, "conf/db.properties");
const properties = propertiesReader(propertiesPath);
const dbPrefix = properties.get("db.prefix");
const dbUser = encodeURIComponent(properties.get("db.user"));
const dbPwd = encodeURIComponent(properties.get("db.pwd"));
const dbName = properties.get("db.dbName");
const dbUrl = properties.get("db.dbUrl");
const dbParams = properties.get("db.params");

// Build the MongoDB URI
const uri = `${dbPrefix}${dbUser}:${dbPwd}${dbUrl}${dbParams}`;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db = client.db(dbName);

console.log(`Connected to MongoDB: ${dbName}`); // This logs after db initialization

// Serve static files directly from the 'front-end' folder
app.use(express.static(path.join(__dirname, "../PulseTech-FrontEnd"))); // Adjust path if needed

// Serve images from the 'Static/Images' folder in the back-end
const imagePath = path.join(__dirname, "Static", "Images");
app.use("/image", express.static(imagePath));

// Middleware to log all incoming requests (excluding favicon.ico)
app.use(function (req, res, next) {
  if (req.url !== "/favicon.ico") {
    console.log("Request URL:", req.url);
  }
  next();
});

// Middleware to log every request
app.use(function (req, res, next) {
  console.log("Request URL:", req.url);
  next();
});

// Dynamically set the MongoDB collection based on the 'collectionName' parameter
app.param('collectionName', function (req, res, next, collectionName) {
  req.collection = db.collection(collectionName);
  return next();
});

// Route to get data from any collection
app.get('/collections/:collectionName', async (req, res, next) => {
  const { collectionName } = req.params; // Get the collection name from the URL
  try {
    const collection = req.collection; // Access the collection from the request object
    const results = await collection.find().toArray(); // Fetch data from the collection
    res.json(results); // Send the results as JSON
  } catch (error) {
    next(error); // Handle any errors
  }
});

// If you want to specifically return the 'legalDocs' JSON file
app.get('/collections/legalDocs', async (req, res, next) => {
  try {
    const legalDocs = await req.collection.find().toArray(); // Fetch data from the legalDocs collection
    if (legalDocs.length === 0) {
      res.status(404).json({ error: "No legal documents found" });
    } else {
      res.json(legalDocs); // Send the legalDocs as JSON
    }
  } catch (error) {
    next(error); // Handle any errors
  }
});


app.get("/collections/PrivacyAndSecurity", async (req, res) => {
  try {
      const db = client.db("yourDatabaseName"); // Replace with your actual DB name
      const collection = db.collection("privacySecurity");
      const data = await collection.find({}).toArray();
      res.json(data);
  } catch (error) {
      console.error("Error fetching privacy and security data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});



// Dynamic Image Serving Route
app.get("/image/:imageName", (req, res) => {
  const imageName = req.params.imageName;
  const fullPath = path.join(imagePath, imageName);

  // Check if image exists
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath);
  } else {
    res.status(404).json({ error: "Image not found" });
  }
});


// Only allow exact matches to the root of the front-end app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../PulseTech-FrontEnd", "index.html"));
});

// Global error handler (last middleware)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Define the port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});
