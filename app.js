// Import necessary dependencies
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const propertiesReader = require("properties-reader");
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const { spawn } = require('child_process');

require('events').EventEmitter.defaultMaxListeners = 20;

const app = express();

// Increase the limit for JSON and URL-encoded bodies
app.use(bodyParser.json({ limit: '10mb' })); // Increase to 10MB (adjust as needed)
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

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

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object to insert into the database
    const newUser = {
      username,
      email,
      password: hashedPassword, // Store the hashed password
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

    // Compare the provided password with the stored hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// Update user profile, including password only if changed
app.post('/updateProfile', async (req, res) => {
  console.log('Update profile route hit');

  try {
    const { email, fullName, username, dateOfBirth, ethnicity, address, phoneNumber, gender, profilePicture, password } = req.body;

    // Find the existing user in the database
    const user = await db.collection("Users").findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let updateData = {
      fullName,
      username,
      dateOfBirth,
      ethnicity,
      address,
      phoneNumber,
      gender,
      profilePicture,
    };

    // Only update the password if the user actually changed it
    if (password && password.trim() !== "" && password !== user.password) {
      updateData.password = await bcrypt.hash(password, 10); // Hash the new password
    } else {
      console.log("Password not changed, keeping the existing password.");
    }

    const result = await db.collection("Users").updateOne(
      { email: email },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "No changes made" });
    }

    res.status(200).json({ message: "User profile updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


app.post("/removeProfilePicture", async (req, res) => {
  try {
    const { email } = req.body; // Use email to find the user

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await db.collection("Users").updateOne(
      { email: email }, // Find user by email
      { $unset: { profilePicture: "" } } // Remove the profilePicture field from the database
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "User not found or no changes made" });
    }

    res.status(200).json({ message: "Profile picture removed successfully" });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


app.post("/getUserProfile", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await db.collection("Users").findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ profilePicture: user.profilePicture || null });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



let pythonProcess = null;

// Function to start a new Python process (ensure it doesn't exit)
function startPythonProcess() {
  if (pythonProcess) {
    console.log("Killing old Python process before starting a new one.");
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }

  pythonProcess = spawn("python", ["symptom_checker.py"], { stdio: ["pipe", "pipe", "pipe"] });

  pythonProcess.stdout.on("data", (data) => {
    console.log(`Python Output: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python Error: ${data.toString().trim()}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null; // Allow restarting if needed
  });

  console.log("New Python process started and waiting for input.");
}

// Restart Python process on every website refresh
app.get("/", (req, res) => {
  console.log(`Page refresh detected: ${req.url}`);
  startPythonProcess();  // Restart AI every refresh
  res.sendFile(path.join(__dirname, "../PulseTech-FrontEnd", "index.html"));
});

// Start the diagnosis session
app.post("/start-diagnosis", (req, res) => {
  startPythonProcess(); // Ensure a fresh start
  res.json({ message: "Diagnosis session started. Please enter your primary symptom" });
});

// Handle user responses
app.post("/answer-question", (req, res) => {
  const { userInput } = req.body;

  if (!pythonProcess) {
    return res.status(400).json({ error: "Diagnosis session not started." });
  }

  let output = "";

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stdin.write(userInput + "\n");

  setTimeout(() => {
    res.json({ message: output.trim() });
  }, 200);
});



app.post("/save-medical-records", async (req, res) => {
  const {
    email,
    fullName,
    dateOfBirth,
    gender,
    bloodType,
    emergencyContact,
    medicalHistory,
    medications,
    vaccinations,
    smokingStatus,
    alcoholConsumption,
    exerciseRoutine,
    sleepPatterns,
    healthLogs,
    labResults,
    doctorVisits,
    heartRate,
    stepCount,
    sleepTracking,
    bloodOxygen,
    organDonorStatus,
    medicalDirectives,
  } = req.body;

  try {
    // Ensure the email field is not null
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Insert or update the medical record
    const existingRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (existingRecord) {
      // Update the existing record
      await db.collection("MedicalRecords").updateOne(
        { userEmail: email },
        {
          $set: {
            fullName,
            dateOfBirth,
            gender,
            bloodType,
            emergencyContact,
            medicalHistory,
            medications,
            vaccinations,
            smokingStatus,
            alcoholConsumption,
            exerciseRoutine,
            sleepPatterns,
            healthLogs,
            labResults,
            doctorVisits,
            heartRate,
            stepCount,
            sleepTracking,
            bloodOxygen,
            organDonorStatus,
            medicalDirectives,
          },
        }
      );
      return res.status(200).json({ message: "Medical records updated successfully" });
    } else {
      // Create a new record
      await db.collection("MedicalRecords").insertOne({
        userEmail: email,
        fullName,
        dateOfBirth,
        gender,
        bloodType,
        emergencyContact,
        medicalHistory,
        medications,
        vaccinations,
        smokingStatus,
        alcoholConsumption,
        exerciseRoutine,
        sleepPatterns,
        healthLogs,
        labResults,
        doctorVisits,
        heartRate,
        stepCount,
        sleepTracking,
        bloodOxygen,
        organDonorStatus,
        medicalDirectives,
      });
      return res.status(201).json({ message: "Medical records saved successfully" });
    }
  } catch (error) {
    console.error("Error saving medical records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




app.get("/get-medical-records", async (req, res) => {
  const userEmail = req.query.email || req.user?.email; // Get email from query parameter or session

  if (!userEmail) {
    return res.status(400).json({ message: "Email not provided" });
  }

  try {
    const medicalRecord = await db.collection("MedicalRecords").findOne({ userEmail: userEmail });

    if (medicalRecord) {
      res.status(200).json(medicalRecord);
    } else {
      res.status(404).json({ message: "No medical records found for this user" });
    }
  } catch (error) {
    console.error("Error fetching medical records:", error);
    res.status(500).json({ message: "Internal server error" });
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