const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// Enable CORS
app.use(cors());

// Serve static files directly from the 'front-end' folder
app.use(express.static(path.join(__dirname, "../front-end"))); // Adjust path if needed

// Serve images from the 'Static/Images' folder in the back-end
const imagePath = path.join(__dirname, "Static", "Images");
app.use("/image", express.static(imagePath));

// Middleware 1: Logs all incoming requests (excluding favicon.ico)
app.use(function (req, res, next) {
  if (req.url !== "/favicon.ico") {
    console.log("Request URL:", req.url);
  }
  next();
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
  res.sendFile(path.join(__dirname, "../front-end", "index.html"));
});

// Catch all other undefined routes and return a 404 error
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Define the port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});
