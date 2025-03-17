require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for file uploads
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file limit
  fileFilter: (req, file, cb) => {
    if (!file || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  }
});

// Debug: Check if environment variables are loaded
console.log("📌 SMTP_USER:", process.env.SMTP_USER || "❌ Not Found");
console.log("📌 SMTP_PASSWORD:", process.env.SMTP_PASSWORD ? "✅ Loaded" : "❌ Not Found");

// Generate a random ticket ID (fallback function)
function generateTicketId() {
  return 'TKT' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Booking Route
app.post("/book", upload.single("screenshot"), async (req, res) => {
  try {
    console.log("📩 [Node.js] Received a booking request...");
    console.log("📜 Request Body:", req.body);
    console.log("📜 File Upload:", req.file ? "✅ Received" : "❌ Not Found");
    
    const { 
      name, 
      email, 
      phone, 
      branch = "Non-MBCET", 
      semester = "N/A",
      // Event details
      eventName = "Premam",
      eventDate = "March 29, 2025",
      eventTime = "11:00 AM",
      eventVenue = "Vishveshwarya Hall",
      screenshotURL,
      ticketId // Extract the ticket ID from the request body
    } = req.body;
    
    // Check if we have a screenshot from the file upload
    const screenshot = req.file;
    
    if (!name || !email || !phone) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Use the ticket ID from the frontend, or generate a fallback if missing
    const finalTicketId = ticketId || generateTicketId();
    console.log("🎫 Using ticket ID:", finalTicketId);
    
    // Setup Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      debug: true, // Enable debugging
    });
    
    // Email options
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Ticket Booking Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Booking Confirmation</h2>
          <p>Hello ${name},</p>
          <p>Your ticket has been successfully booked! Here are your details:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Ticket ID:</strong> ${finalTicketId}</p>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Branch:</strong> ${branch}</p>
            ${semester !== "N/A" ? `<p><strong>Semester:</strong> ${semester}</p>` : ''}
          </div>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="color: #333; margin-top: 0;">Event Details</h3>
            <p><strong>Event:</strong> ${eventName}</p>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Time:</strong> ${eventTime}</p>
            <p><strong>Venue:</strong> ${eventVenue}</p>
          </div>
          <p>Please keep this email for your records. You may be required to show your ticket ID at the event.</p>
          <p>If you have any questions, please contact us.</p>
          <p style="text-align: center; margin-top: 30px; color: #666;">Thank you for your booking!</p>
        </div>
      `
    };
    
    // Add the screenshot attachment if available
    if (screenshot) {
      mailOptions.attachments = [
        {
          filename: screenshot.filename,
          path: screenshot.path
        }
      ];
    } else if (screenshotURL) {
      // If we have a URL from Cloudinary, we can mention it in the email
      mailOptions.html += `
        <p style="text-align: center;">Your payment screenshot has been received.</p>
      `;
    }
    
    // Send Email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`❌ Email failed: ${error.message}`);
        return res.status(500).json({ error: "Failed to send email", details: error.message });
      }
      
      console.log(`📧 Email sent successfully to ${email}: ${info.response}`);
      return res.status(200).json({ 
        message: "Booking successful! Email sent.",
        ticketId: finalTicketId
      });
    });
    
  } catch (error) {
    console.error("❌ [Node.js] Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));