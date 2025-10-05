import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: String, required: true },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now },
});

export default mongoose.model('Message', MessageSchema);
