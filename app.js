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

// Serve static files directly from the 'PulseTech-FrontEnd' folder
app.use(express.static(path.join(__dirname, "../PulseTech-FrontEnd")));

// Serve images from the 'Static/Images' folder in the back-end
const imagePath = path.join(__dirname, "Static", "Images");
app.use("/image", express.static(imagePath));

// Middleware to log all incoming requests (excluding favicon.ico)
app.use((req, res, next) => {
  if (req.url !== "/favicon.ico") {
    console.log("Request URL:", req.url);
  }
  next();
});

// Dynamically set the MongoDB collection based on the 'collectionName' parameter
app.param('collectionName', (req, res, next, collectionName) => {
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

// Get Privacy and Security from MongoDB
app.get("/collections/PrivacyAndSecurity", async (req, res) => {
  try {
    const data = await getCollectionData("PrivacyAndSecurity");
    if (data && data.length > 0) {
      res.json(data);
    } else {
      res.status(404).send({ message: "Privacy and Security docs not found" });
    }
  } catch (error) {
    console.error("Error fetching Privacy and Security docs:", error);
    res.status(500).send({ message: "Error fetching Privacy and Security docs" });
  }
});


// Get Health and Wellness Guidelines from MongoDB
app.get("/collections/HealthAndWellnessGuidelines", async (req, res) => {
  try {
    const data = await getCollectionData("HealthAndWellnessGuidelines");
    if (data && data.length > 0) {
      res.json(data);
    } else {
      res.status(404).send({ message: "Health and Wellness Guidelines not found" });
    }
  } catch (error) {
    console.error("Error fetching Health and Wellness Guidelines:", error);
    res.status(500).send({ message: "Error fetching Health and Wellness Guidelines" });
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



app.post("/register", async (req, res) => {
  try {
    const { username, email, password, role, medicalLicense } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const usersCollection = db.collection("Users");

    // Check if the email already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Create user object to insert into the database
    const newUser = {
      username,
      email,
      password, // Password stored directly (No hashing since bcrypt is not used)
      role,
    };

    // Add medical license for doctors
    if (role === "doctor" && medicalLicense) {
      newUser.medicalLicense = medicalLicense;
    }

    // Store user in the database
    await usersCollection.insertOne(newUser);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const usersCollection = db.collection("Users");

    // Find user by email
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password (No hashing since bcrypt is not used)
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


app.post('/updateProfile', async (req, res) => {
  try {
    const { email, fullName, username, dateOfBirth, ethnicity, address, phoneNumber, gender, profilePicture } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Prepare the update data
    let updateData = {};

    if (fullName) updateData.fullName = fullName;
    if (username) updateData.username = username;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (ethnicity) updateData.ethnicity = ethnicity;
    if (address) updateData.address = address;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (gender) updateData.gender = gender;
    if (profilePicture) updateData.profilePicture = profilePicture; // Base64 image

    // Log the data to be updated
    console.log("Updating user data:", updateData);

    // Ensure we're finding the user by email
    const result = await db.collection("Users").updateOne(
      { email: email },  // Use email to find the user
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "User not found or no changes made" });
    }

    res.status(200).json({ message: "User profile updated successfully", user: updateData });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});








// Serve index.html for root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../PulseTech-FrontEnd", "index.html"));
});

// Catch-all route for Vue's frontend views (fixes refresh issue)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../PulseTech-FrontEnd", "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Define the port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});
