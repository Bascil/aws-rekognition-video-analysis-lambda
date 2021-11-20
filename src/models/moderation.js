const Mongoose = require('mongoose');
const { Schema } = Mongoose;

// Moderation Schema
const ModerationSchema = new Schema(
  {
    videoId: {
      type: String,
      required: true,
    },
    videoName: {
      type: String,
      required: false,
    },
    videoBucket: {
      type: String,
      required: false,
    },
    ageRestriction: {
      type: Boolean,
      default: false,
    },
    labels: {
      type: Array,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: Date,
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

module.exports = Mongoose.model('Moderation', ModerationSchema);
