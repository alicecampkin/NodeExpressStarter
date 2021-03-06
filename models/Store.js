const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const slugs = require('slugs');

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: 'Please enter a store name',
    },

    slug: String,

    description: {
      type: String,
      trim: true,
    },

    tags: [String],

    created: {
      type: Date,
      default: Date.now,
    },

    location: {
      type: {
        type: String,
        default: 'Point',
      },
      coordinates: [
        {
          type: Number,
          required: 'You must supply coordinates!',
        },
      ],
      address: {
        type: String,
        required: 'You must supply an address!',
      },
    },

    photo: String,

    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: 'You must supply an author!',
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

storeSchema.index({
  name: 'text',
  description: 'text',
});

storeSchema.index({
  location: '2dsphere',
});

// Generate slug before saving to database - Video 09
storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    // skip slug generation if name has not been modified
    return next();
  }
  this.slug = slugs(this.name);

  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');

  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  // TO DO:
  // modify function to ensure slugs are unique
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews',
      },
    },

    // Filter for only items that have 2 or more reviews. reviews[1].exists
    {
      $match: {
        'reviews.1': { $exists: true },
      },
    },

    // add average rating field
    {
      $project: {
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        slug: '$$ROOT.slug',
        reviews: '$$ROOT.reviews',
        averageRating: { $avg: '$reviews.rating' },
      },
    },

    // sort by highest average rating first

    { $sort: { averageRating: -1 } },

    // limit to 10 stores

    { $limit: 10 },
  ]);
};

storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store', // which field on the review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
