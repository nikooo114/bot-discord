const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  userId: String,
  channelId: String,
  type: String,
  priority: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ticket", ticketSchema);
