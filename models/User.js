
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';


const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  skills: { type: [String], default: [] },
  bio: { type: String, default: "" },
  linkedin: { type: String, default: "" },
  github: { type: String, default: "" },
  badges: { type: [String], default: [] },
  resolvedHistory: [
    {
      issueId: String,
      title: String,
      language: String,
      urgency: String,
      resolvedOn: { type: Date, default: Date.now },
    },
  ],
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);
