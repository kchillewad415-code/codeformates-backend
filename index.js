import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from "uuid";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Issue from './models/Issue.js';
import User from './models/User.js';
import Session from './models/Session.js';
import Message from './models/Message.js';
import nodemailer from 'nodemailer';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Preserve original extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE'],
  // Note: credentials (cookies, auth headers) **cannot** be used with '*'
}));

app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));


app.get('/', (req, res) => {
  res.send('CodeMate Backend API');
});

// POST /issues
app.post('/issues', upload.single('file'), async (req, res) => {
  try {
    const issueData = {
      title: req.body.title,
      description: req.body.description,
      language: req.body.language,
      urgency: req.body.urgency,
      file: req.file,
      isOpen: true,
      userid: req.body.userid,
    };
    const issue = await Issue.create(issueData);
    res.status(201).json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /issues
app.get('/issues', async (req, res) => {
  try {
    const issues = await Issue.find();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /issues/:id
app.get('/issues/:id', async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//PUT /issues
app.put('/issues/:id', async (req, res) => {
  try {
    const updatedIssue = await Issue.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedIssue) {
      return res.status(404).json({ message: "Issue not found" });
    }
    res.json(updatedIssue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sessions
app.post('/sessions', async (req, res) => {
  try {
    const session = await Session.create(req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sessions
app.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users
app.post('/users', async (req, res) => {
  try {
    const userData = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      isOnline: req.body.isOnline,
      skills: req.body.skills,
    };
    const user = new User(userData);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//PUT /users
app.put('/users/:id', async (req, res) => {
  try {
    let updateData = { ...req.body };
    // Always ignore password unless explicitly updating
    if (!req.body.newPassword) {
      delete updateData.password;
    }
    // If updating password, hash and set
    if (req.body.newPassword) {
      const bcrypt = await import('bcrypt');
      const salt = await bcrypt.default.genSalt(10);
      updateData.password = await bcrypt.default.hash(req.body.newPassword, salt);
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Password received at login:', password); // Debugging line
  
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track online users per room
const roomUsers = {};

// REST endpoint to get chat history for a room
app.get('/chat/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId }).sort({ time: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', async (roomId, username) => {
    socket.join(roomId);
    // Add user to roomUsers
    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(username);
    console.log(`User ${socket.id} joined room ${roomId}`);
    // Send chat history to the user
    const messages = await Message.find({ roomId }).sort({ time: 1 });
    socket.emit('chatHistory', messages);
  });

  socket.on('chatMessage', async ({ roomId, message, sender, email }) => {
    const msg = new Message({ roomId, message, sender });
    await msg.save();
    io.to(roomId).emit('chatMessage', { message, sender, time: msg.time });
    // Get issue details for this room
    const issue = await Issue.findById(roomId);
    const issueTitle = issue ? issue.title : roomId;
    // Notify all users in the room except sender
    const usersInRoom = roomUsers[roomId] || new Set();
    const allUsers = await User.find();
    for (const user of allUsers) {
      if (!usersInRoom.has(user.username) && user.username !== sender) {
        // Send email notification with issue info and direct link
        const chatroomUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/livesession/${roomId}`;
        sendEmailNotification(
          user.email,
          `New message in chatroom for issue: ${issueTitle}`,
          `${sender} sent a message in the chatroom for issue "${issueTitle}":\n${message}\n\nJoin the chatroom: ${chatroomUrl}`
        );
      }
    }
    // Optionally, send notification to sender's own email (if needed)
    // if (email) {
    //   sendEmailNotification(email, `You sent a message in chatroom ${roomId}`, `You: ${message}`);
    // }
  });

  socket.on('disconnect', () => {
    // Remove user from all rooms
    for (const roomId in roomUsers) {
      roomUsers[roomId].delete(socket.username);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Email setup (use your own credentials or environment variables)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function sendEmailNotification(to, subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };
  return transporter.sendMail(mailOptions);
}
// Contact form endpoint
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    const toEmail = process.env.EMAIL_USER;
    const subject = `Contact Form Submission from ${name}`;
    const text = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
    await sendEmailNotification(toEmail, subject, text);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email.' });
  }
});
// Password reset endpoint
app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token.' });
    user.password = password; // Let pre-save hook hash it
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});
// Password reset request endpoint
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Generate a simple token (for demo; use JWT or crypto for production)
    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
    await user.save();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    await sendEmailNotification(
      email,
      'Password Reset Request',
      `Hi ${user.username},\n\nTo reset your password, click the link below:\n${resetUrl}\n\nIf you did not request this, ignore this email.`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});
httpServer.listen(PORT, () => console.log(`CodeMate backend running on port ${PORT}`));