import mongoose from 'mongoose';

const IssueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  language: { type: String },
  urgency: { type: String },
  file: { type: Object },
  isOpen: { type: Boolean, default: true },
  userid: { type: String },
  resolvedBy: { type: String, default: null },
  solution: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('Issue', IssueSchema);
