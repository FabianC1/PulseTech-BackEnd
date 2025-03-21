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

app.use((req, res, next) => {
  // Skip logging for /get-messages route
  if (req.url.startsWith("/get-messages")) {
    return next();  // Skip logging and continue to the next middleware
  }

  // Otherwise, log the request
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await db.collection("Users").updateOne(
      { email: email }, 
      { $set: { profilePicture: null } } // ✅ Fix: Set profilePicture to null instead of removing it
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "User not found or no changes made" });
    }

    res.status(200).json({ message: "Profile picture set to null successfully" });
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

function startPythonProcess() {
  // If an existing process is running, kill it first.
  if (pythonProcess) {
    console.log("Terminating existing Python process...");
    pythonProcess.kill();  // Sends the default signal (SIGTERM)
    pythonProcess = null;
  }

  console.log("Starting new Python process...");
  pythonProcess = spawn("python", ["symptom_checker.py"], { stdio: ["pipe", "pipe", "pipe"] });

  pythonProcess.stdout.on("data", (data) => {
    console.log(`Python Output: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python Error: ${data.toString().trim()}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null; // Allow restart
  });

  console.log("New Python process started and waiting for input.");
}

// Restart Python process on every website refresh
app.get("/", (req, res) => {
  console.log(`Page refresh detected: ${req.url}`);
  startPythonProcess();  // This will kill any existing process and start a new one.
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
    sleepTracking, // Add Sleep Tracking
    bloodOxygen,
    organDonorStatus,
    medicalDirectives,
  } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (existingRecord) {
      // Ensure arrays exist before appending new data
      const heartRateLogs = Array.isArray(existingRecord.heartRate) ? existingRecord.heartRate : [];
      const stepCountLogs = Array.isArray(existingRecord.stepCount) ? existingRecord.stepCount : [];
      const sleepTrackingLogs = Array.isArray(existingRecord.sleepTracking) ? existingRecord.sleepTracking : []; // Ensure Sleep Tracking array exists
      const bloodOxygenLogs = Array.isArray(existingRecord.bloodOxygen) ? existingRecord.bloodOxygen : [];

      // Append new Heart Rate log
      if (heartRate !== undefined) {
        heartRateLogs.push({ time: new Date().toISOString(), value: heartRate });
      }

      // Append new Step Count log
      if (stepCount !== undefined) {
        stepCountLogs.push({ time: new Date().toISOString(), value: stepCount });
      }

      // Append new Sleep Tracking log
      if (sleepTracking !== undefined) {
        sleepTrackingLogs.push({ time: new Date().toISOString(), value: sleepTracking });
      }

      // Append new Blood Oxygen log
      if (bloodOxygen !== undefined) {
        bloodOxygenLogs.push({ time: new Date().toISOString(), value: bloodOxygen });
      }

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
            heartRate: heartRateLogs,
            stepCount: stepCountLogs,
            sleepTracking: sleepTrackingLogs, // Append new Sleep Tracking logs
            bloodOxygen: bloodOxygenLogs, // Append blood oxygen logs
            organDonorStatus,
            medicalDirectives,
          },
        }
      );

      return res.status(200).json({ message: "Medical records updated successfully" });
    } else {
      // Create a new record with logs initialized as arrays
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
        heartRate: heartRate !== undefined
        ? [{ time: req.body.heartRateTime || new Date().toISOString(), value: heartRate }]
        : [],
      
      stepCount: stepCount !== undefined
        ? [{ time: req.body.stepCountTime || new Date().toISOString(), value: stepCount }]
        : [],
      
      sleepTracking: sleepTracking !== undefined
        ? [{ time: req.body.sleepTrackingTime || new Date().toISOString(), value: sleepTracking }]
        : [],      
        bloodOxygen: bloodOxygen !== undefined ? [{ time: new Date().toISOString(), value: bloodOxygen }] : [], // Blood oxygen tracking initialized
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
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const medicalRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (!medicalRecord) {
      return res.status(404).json({ message: "No medical records found for this user" });
    }

    // Extract the most recent value from each log array (or default to 0 if empty)
    const getLatestValue = (logs) => (Array.isArray(logs) && logs.length > 0 ? logs[logs.length - 1].value : 0);

    const formattedRecord = {
      ...medicalRecord,
      heartRate: getLatestValue(medicalRecord.heartRate),
      stepCount: getLatestValue(medicalRecord.stepCount),
      sleepTracking: getLatestValue(medicalRecord.sleepTracking),
      bloodOxygen: getLatestValue(medicalRecord.bloodOxygen),
    };

    return res.status(200).json(formattedRecord);
  } catch (error) {
    console.error("Error fetching medical records:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// Get All Patients (For Doctors)
app.get("/get-patients", async (req, res) => {
  try {
    const patients = await db.collection("Users").find({ role: "patient" }).toArray();
    res.json(patients); // Ensure this returns JSON
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get All Doctors (For Patients)
app.get("/get-doctors", async (req, res) => {
  try {
    const doctors = await db.collection("Users").find({ role: "doctor" }).toArray();
    res.json(doctors); // Ensure this returns JSON
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Create an Appointment
app.post("/create-appointment", async (req, res) => {
  try {
    const { doctorEmail, patientEmail, date, reason, status = "Scheduled" } = req.body;

    if (!doctorEmail || !patientEmail || !date || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await db.collection("Appointments").insertOne({
      doctorEmail,
      patientEmail,
      date,
      reason,
      status,
    });

    res.status(201).json({ message: "Appointment scheduled successfully" });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update Appointment Status to Completed (For Doctors)
app.post("/update-appointment-status", async (req, res) => {
  const { appointmentId } = req.body; // Only need the appointment ID

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment ID is required" });
  }

  try {
    const result = await db.collection("Appointments").updateOne(
      { _id: new ObjectId(appointmentId) }, // Use the appointment ID to find the record
      { $set: { status: "Completed" } } // Update the status to "Completed"
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json({ message: "Appointment status updated to completed successfully" });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// Get Appointments for Logged-In User
app.get("/get-appointments", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Email not provided" });
  }

  try {
    const appointments = await db.collection("Appointments").find({
      $or: [{ doctorEmail: email }, { patientEmail: email }],
    }).toArray();

    res.json(appointments); // Ensure this returns JSON
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// View Medical Records of a Specific Patient (For Doctors)
app.get("/view-patient-records", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Patient email required" });
  }

  try {
    const medicalRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (medicalRecord) {
      res.json(medicalRecord);
    } else {
      res.status(404).json({ message: "No medical records found for this patient" });
    }
  } catch (error) {
    console.error("Error fetching patient medical records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




app.get("/collections/Medications", async (req, res) => {
  const { name } = req.query;

  try {
    // Match medications by name (case insensitive)
    const medications = await db.collection("Medications").find({
      name: { $regex: name, $options: "i" }  // Case-insensitive search
    }).toArray();

    res.json(medications);  // Return the medications as JSON
  } catch (error) {
    console.error("Error fetching medications:", error);
    res.status(500).send({ message: "Error fetching medications" });
  }
});


app.post("/save-medication", async (req, res) => {
  const { email, medication } = req.body;

  if (!email || !medication || !medication.name || !medication.timeToTake) {
    return res.status(400).json({ message: "Invalid data. Medication name and time to take are required." });
  }

  try {
    const userRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (!userRecord) {
      return res.status(404).json({ message: "User not found." });
    }

    // Ensure medication logs exist
    medication.logs = medication.logs || []; // Ensure logs array is initialized

    const updatedMedications = userRecord.medications || [];
    updatedMedications.push(medication);

    const result = await db.collection("MedicalRecords").updateOne(
      { userEmail: email },
      { $set: { medications: updatedMedications } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Medication saved successfully!" });
    } else {
      res.status(500).json({ message: "Failed to update medical records." });
    }
  } catch (error) {
    console.error("Error saving medication:", error);
    res.status(500).json({ message: "Server error" });
  }
});




function calculateNextDoseTime(currentTime, frequency) {
  const nextDose = new Date(currentTime);

  const freqMap = {
    "Every hour": 1,
    "Every 2 hours": 2,
    "Every 4 hours": 4,
    "Every 6 hours": 6,
    "Every 8 hours": 8,
    "Every 12 hours": 12,
    "Once a day": 24,
    "Once a week": 168,
  };

  if (!freqMap[frequency]) return null; // Prevent errors

  nextDose.setHours(nextDose.getHours() + freqMap[frequency]);
  return nextDose.toISOString();
}



//  Mark medication as "Taken"
app.post("/mark-medication-taken", async (req, res) => {
  const { email, medicationName } = req.body;

  try {
    const userRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (!userRecord) return res.status(404).json({ message: "User not found." });

    const medicationIndex = userRecord.medications.findIndex(med => med.name === medicationName);

    if (medicationIndex === -1) return res.status(404).json({ message: "Medication not found." });

    const now = new Date();
    const medication = userRecord.medications[medicationIndex];

    if (!medication.logs) medication.logs = [];
    medication.logs.push({ time: now.toISOString(), status: "Taken" });

    medication.nextDoseTime = calculateNextDoseTime(now, medication.frequency);

    const updatedMedications = userRecord.medications.map((med, index) =>
      index === medicationIndex ? medication : med
    );

    await db.collection("MedicalRecords").updateOne(
      { userEmail: email },
      { $set: { medications: updatedMedications } }
    );

    res.status(200).json({ message: "Medication marked as taken successfully!" });
  } catch (error) {
    console.error("Error marking medication as taken:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//  Automatically Mark Medication as "Missed"
app.post("/mark-medication-missed", async (req, res) => {
  const { email, medicationName } = req.body;

  try {
    const userRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (!userRecord) return res.status(404).json({ message: "User not found." });

    const medicationIndex = userRecord.medications.findIndex(med => med.name === medicationName);

    if (medicationIndex === -1) return res.status(404).json({ message: "Medication not found." });

    const medication = userRecord.medications[medicationIndex];

    if (!medication.logs) medication.logs = [];
    medication.logs.push({ time: new Date().toISOString(), status: "Missed" });

    const updatedMedications = userRecord.medications.map((med, index) =>
      index === medicationIndex ? medication : med
    );

    await db.collection("MedicalRecords").updateOne(
      { userEmail: email },
      { $set: { medications: updatedMedications } }
    );

    res.status(200).json({ message: "Medication marked as missed successfully!" });
  } catch (error) {
    console.error("Error marking medication as missed:", error);
    res.status(500).json({ message: "Server error" });
  }
});






app.get("/get-contacts", async (req, res) => {
  try {
    const { email } = req.query; // Get email from query params

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the logged-in user
    const user = await db.collection("Users").findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Determine the user's role
    const userRole = user.role;

    // If user is a patient, get all doctors. If user is a doctor, get all patients.
    const contacts = await db
      .collection("Users")
      .find({ role: userRole === "doctor" ? "patient" : "doctor" })
      .project({ fullName: 1, email: 1, profilePicture: 1 }) // Select fields to return
      .toArray();

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/get-messages", async (req, res) => {
  try {
    const { sender, recipient } = req.query;

    if (!sender || !recipient) {
      return res.status(400).json({ message: "Sender and recipient are required." });
    }

    const messages = await db.collection("messages")
      .find({
        $or: [
          { sender, receiver: recipient },
          { sender: recipient, receiver: sender }
        ]
      })
      .sort({ timestamp: 1 }) // Oldest to newest
      .toArray();

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.post("/send-message", async (req, res) => {
  try {
    const { sender, receiver, message, attachment, timestamp } = req.body;

    if (!sender || !receiver) {
      return res.status(400).json({ message: "Sender and receiver are required." });
    }

    const messageData = {
      sender,
      receiver,
      message: message || null,
      attachment: attachment || null,
      timestamp,
    };

    await db.collection("messages").insertOne(messageData);

    res.status(201).json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.get("/get-health-dashboard", async (req, res) => {
  try {
    const { email, lastUpdated } = req.query;
    console.log("Health Dashboard API Called for:", email);

    const user = await db.collection("Users").findOne({ email });
    if (!user) {
      console.log("User not found in database.");
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Fetch the latest modification timestamp from Appointments, Medications, and Logs
    const latestAppointment = await db.collection("Appointments").findOne(
      { $or: [{ patientEmail: email }, { doctorEmail: email }] },
      { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }
    );

    const latestMedicalRecord = await db.collection("MedicalRecords").findOne(
      { userEmail: email },
      { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }
    );

    const latestUpdateTime = [latestAppointment?.updatedAt, latestMedicalRecord?.updatedAt]
      .filter(Boolean)  // Remove null values
      .map(date => new Date(date))  // Convert to Date objects
      .sort((a, b) => b - a)[0]; // Get the most recent timestamp

    const latestUpdateISO = latestUpdateTime ? latestUpdateTime.toISOString() : "";

    // 🔹 If lastUpdated is provided and no changes were made since, return "No Updates"
    if (lastUpdated && latestUpdateISO && new Date(lastUpdated) >= latestUpdateTime) {
      return res.json({ message: "No Updates" });
    }

    // 🔹 Fetch Recent & Upcoming Appointments
    let recentAppointments = await db.collection("Appointments")
      .find({ $or: [{ patientEmail: email }, { doctorEmail: email }], status: "Completed" })
      .sort({ date: -1 })
      .limit(3)
      .toArray();

    let upcomingAppointments = await db.collection("Appointments")
      .find({ $or: [{ patientEmail: email }, { doctorEmail: email }], status: "Scheduled" })
      .sort({ date: 1 })
      .limit(3)
      .toArray();

    // 🔹 Fetch Doctor Names
    const doctorEmails = [...new Set([...recentAppointments, ...upcomingAppointments].map(appt => appt.doctorEmail))];
    const doctors = await db.collection("Users").find({ email: { $in: doctorEmails } }).toArray();
    const doctorMap = {};
    doctors.forEach(doc => {
      doctorMap[doc.email] = doc.fullName ? `Dr. ${doc.fullName}` : "Unknown Doctor";
    });

    // 🔹 Fetch Patient Names
    const patientEmails = [...new Set([...recentAppointments, ...upcomingAppointments].map(appt => appt.patientEmail))];
    const patients = await db.collection("Users").find({ email: { $in: patientEmails } }).toArray();
    const patientMap = {};
    patients.forEach(pat => {
      patientMap[pat.email] = pat.fullName || "Unknown Patient";
    });

    // 🔹 Attach Doctor and Patient Names to Appointments
    recentAppointments = recentAppointments.map(appt => ({
      ...appt,
      doctorName: doctorMap[appt.doctorEmail] || "Unknown Doctor",
      patientName: patientMap[appt.patientEmail] || "Unknown Patient"
    }));

    upcomingAppointments = upcomingAppointments.map(appt => ({
      ...appt,
      doctorName: doctorMap[appt.doctorEmail] || "Unknown Doctor",
      patientName: patientMap[appt.patientEmail] || "Unknown Patient"
    }));


    // 🔹 Fetch Medical Records
    const userRecord = await db.collection("MedicalRecords").findOne(
      { userEmail: email },
      {
        projection: {
          heartRate: { $slice: -20 },
          stepCount: { $slice: -20 },
          sleepTracking: { $slice: -20 },
          medicalLogs: { $slice: -7 },
          medications: 1
        }
      }
    );

    const medications = userRecord?.medications || [];
    const heartRateLogs = userRecord?.heartRate ?? [];
    const stepCountLogs = userRecord?.stepCount ?? [];
    const sleepTrackingLogs = userRecord?.sleepTracking ?? [];
    const medicalLogs = userRecord?.medicalLogs ?? [];

    // 🔹 Compute Medication Statistics
    const medicationStats = { dates: [], taken: [], missed: [] };
    medications.forEach(med => {
      med.logs.forEach(log => {
        const date = log.time.split("T")[0];
        if (!medicationStats.dates.includes(date)) {
          medicationStats.dates.push(date);
          medicationStats.taken.push(0);
          medicationStats.missed.push(0);
        }
        const index = medicationStats.dates.indexOf(date);
        if (log.status === "Taken") {
          medicationStats.taken[index]++;
        } else if (log.status === "Missed") {
          medicationStats.missed[index]++;
        }
      });
    });

    // 🔹 Generate Health Alerts
    const totalMissed = medicationStats.missed.reduce((sum, count) => sum + count, 0);
    const healthAlerts = [];

    // 1️⃣ Next Medication Dose Reminder
    const nextDoseSoon = medications.some(med => {
      const nextDoseTime = med.nextDose ? new Date(med.nextDose) : null;
      if (!nextDoseTime) return false;
      const diffMinutes = Math.floor((nextDoseTime - new Date()) / 60000);
      return diffMinutes > 0 && diffMinutes <= 60;
    });
    if (nextDoseSoon) healthAlerts.push("You have a medication dose due soon.");

    // 2️⃣ Overdue Medication Alert
    const overdueMedications = medications.filter(med =>
      med.logs.some(log => log.status === "Missed" && !log.markedAsTaken)
    ).length;
    if (overdueMedications > 0) healthAlerts.push(`You have ${overdueMedications} overdue medication(s).`);

    // 3️⃣ Critical Medication Warning
    const criticalMissedMeds = medications.filter(med =>
      med.logs.filter(log => log.status === "Missed").length >= 3
    ).length;
    if (criticalMissedMeds > 0) healthAlerts.push("Warning: You have missed 3+ doses of a critical medication.");

    // 4️⃣ Doctor Contact Suggestion
    if (totalMissed >= 5) {
      healthAlerts.push(`You have missed ${totalMissed} medications! Please contact your doctor.`);
    }

    // 🔹 Return Updated Data
    res.json({
      recentAppointments,
      upcomingAppointments,
      medicationStats,
      healthAlerts,
      heartRateLogs,
      stepCountLogs,
      sleepTrackingLogs,
      medicalLogs,
      lastUpdated: latestUpdateISO // Send latest update timestamp
    });

    console.log("Returned updated Health Dashboard data.");

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Server error" });
  }
});







app.post("/add-health-data", async (req, res) => {
  try {
    const { email, type, date, value } = req.body;

    if (!email || !type || !date || value === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const validTypes = ["heartRate", "stepCount", "sleepTracking", "medicalLogs"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid data type" });
    }

    const userRecord = await db.collection("MedicalRecords").findOne({ userEmail: email });

    if (!userRecord) {
      return res.status(404).json({ message: "User record not found" });
    }

    // Convert date to ISO format (ensuring it's a valid date)
    const formattedDate = new Date(date);
    if (isNaN(formattedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Prepare new log entry
    const newEntry = { time: formattedDate.toISOString(), value };

    // Update the correct field dynamically
    const updateField = {};
    updateField[type] = [...(userRecord[type] || []), newEntry]; // Append new data

    await db.collection("MedicalRecords").updateOne(
      { userEmail: email },
      { $set: updateField }
    );

    res.json({ message: `${type} data added successfully!`, newEntry });
  } catch (error) {
    console.error("Error adding health data:", error);
    res.status(500).json({ message: "Server error" });
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