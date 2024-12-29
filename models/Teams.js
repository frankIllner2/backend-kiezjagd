const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  players: { type: [String], required: true },
  gameId: { type: String, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
});

module.exports = mongoose.model('Team', teamSchema);
