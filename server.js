const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'));
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configure file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure file filter
const fileFilter = (req, file, cb) => {
    if(file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/college_events', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Schema Definitions
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'coordinator'] },
    createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    venue: { type: String, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['academic', 'cultural', 'sports', 'technical']
    },
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    maxParticipants: { type: Number, required: true },
    flyer: { type: String },
    registrations: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registrationDate: { type: Date, default: Date.now },
        attended: { type: Boolean, default: false }
    }],
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed'],
        default: 'upcoming'
    },
    createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Event = mongoose.model('Event', eventSchema);

// JWT Middleware
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Routes

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        let user = await User.findOne({ email });

        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await User.create({
                email,
                password: hashedPassword,
                role
            });
        } else {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            if (user.role !== role) {
                return res.status(401).json({ success: false, message: 'Invalid role for this account' });
            }
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '24h' }
        );

        res.json({ success: true, token, userId: user._id, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create Event Route
app.post('/api/events', authMiddleware, upload.single('flyer'), async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('File:', req.file);
        console.log('User:', req.user);

        if(req.user.role !== 'coordinator') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const eventData = {
            ...req.body,
            coordinator: req.user.userId,
            flyer: req.file ? `/uploads/${req.file.filename}` : null
        };

        console.log('Event data to be created:', eventData);
        const event = await Event.create(eventData);
        res.json({ success: true, event });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// Get Events Route
app.get('/api/events', authMiddleware, async (req, res) => {
    try {
        const events = await Event.find({
            date: { $gte: new Date() }
        }).sort({ date: 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
});

// Register for Event Route
app.post('/api/events/:eventId/register', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can register for events' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.registrations.length >= event.maxParticipants) {
            return res.status(400).json({ message: 'Event is full' });
        }

        const alreadyRegistered = event.registrations.some(
            reg => reg.student.toString() === req.user.userId
        );

        if (alreadyRegistered) {
            return res.status(400).json({ message: 'Already registered for this event' });
        }

        event.registrations.push({
            student: req.user.userId,
            registrationDate: new Date()
        });

        await event.save();

        // Send confirmation email
        const user = await User.findById(req.user.userId);
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Event Registration Confirmation',
            text: `You've successfully registered for "${event.title}" on ${event.date}.`
        };

        transporter.sendMail(mailOptions);
        
        res.json({ success: true, message: 'Successfully registered for event' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering for event' });
    }
});

// Get Events by Category
app.get('/api/events/category/:category', authMiddleware, async (req, res) => {
    try {
        const events = await Event.find({ 
            category: req.params.category,
            date: { $gte: new Date() }
        }).sort({ date: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching events' });
    }
});

// Search Events
app.get('/api/events/search', authMiddleware, async (req, res) => {
    try {
        const searchTerm = req.query.q;
        const events = await Event.find({
            $and: [
                {
                    $or: [
                        { title: { $regex: searchTerm, $options: 'i' } },
                        { description: { $regex: searchTerm, $options: 'i' } }
                    ]
                },
                { date: { $gte: new Date() } }
            ]
        }).sort({ date: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Error searching events' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
app.delete('/api/events/:eventId', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Only allow deletion by the coordinator who created the event
        if (event.coordinator.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized to delete this event' });
        }

        await Event.findByIdAndDelete(req.params.eventId);
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Error deleting event' });
    }
});
const formFieldSchema = new mongoose.Schema({
    fieldName: { type: String, required: true },
    fieldType: { 
        type: String, 
        required: true,
        enum: ['text', 'email', 'number', 'select', 'date']
    },
    required: { type: Boolean, default: false },
    options: [String], // For select fields
    placeholder: String
});

const registrationFormSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    fields: [formFieldSchema],
    createdAt: { type: Date, default: Date.now }
});

const registrationResponseSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responses: [{
        fieldId: mongoose.Schema.Types.ObjectId,
        fieldName: String,
        response: String
    }],
    submittedAt: { type: Date, default: Date.now }
});

const RegistrationForm = mongoose.model('RegistrationForm', registrationFormSchema);
const RegistrationResponse = mongoose.model('RegistrationResponse', registrationResponseSchema);

// Update the eventSchema to include a reference to the registration form
eventSchema.add({
    registrationForm: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationForm' }
});

// API Routes for Registration Forms

// Create registration form for an event
app.post('/api/events/:eventId/registration-form', authMiddleware, async (req, res) => {
    try {
        console.log('Received request for registration form:', req.body, req.params.eventId);

        if (req.user.role !== 'coordinator') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.coordinator.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to modify this event' });
        }

        if (!req.body.fields || req.body.fields.length === 0) {
            return res.status(400).json({ message: 'Fields data is missing' });
        }

        const form = await RegistrationForm.create({
            eventId: event._id,
            fields: req.body.fields
        });

        event.registrationForm = form._id;
        await event.save();

        res.json({ success: true, form });
    } catch (error) {
        console.error('Error creating registration form:', error);
        res.status(500).json({ message: 'Error creating registration form' });
    }
});


// Get registration form for an event
app.get('/api/events/:eventId/registration-form', authMiddleware, async (req, res) => {
    try {
        const form = await RegistrationForm.findOne({ eventId: req.params.eventId });
        if (!form) {
            return res.status(404).json({ message: 'Registration form not found' });
        }
        res.json(form);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registration form' });
    }
});

// Submit registration response
app.post('/api/events/:eventId/register', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can register' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if already registered
        const existingRegistration = await RegistrationResponse.findOne({
            eventId: event._id,
            studentId: req.user.userId
        });

        if (existingRegistration) {
            return res.status(400).json({ message: 'Already registered for this event' });
        }

        // Create registration response
        const response = await RegistrationResponse.create({
            eventId: event._id,
            studentId: req.user.userId,
            responses: req.body.responses
        });

        // Update event registrations
        event.registrations.push({
            student: req.user.userId,
            registrationDate: new Date()
        });
        await event.save();

        res.json({ success: true, response });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting registration' });
    }
});
