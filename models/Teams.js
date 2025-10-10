const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  players: { type: [String], required: true },
  gameId: { type: String, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
});

teamSchema.index({ gameId: 1, endTime: 1 });
teamSchema.index({ gameId: 1, startTime: 1 });

module.exports = mongoose.model('Team', teamSchema);
