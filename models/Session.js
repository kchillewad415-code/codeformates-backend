import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  // You can add more fields as needed
  title: { type: String },
  description: { type: String },
  participants: { type: [String], default: [] },
  startTime: { type: Date },
  endTime: { type: Date },
  // Store any other session-related data
}, { timestamps: true });

export default mongoose.model('Session', SessionSchema);
