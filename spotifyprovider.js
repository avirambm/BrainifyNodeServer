/**
 * This file handles the logic and DB actions related to the spotify actions.
 * User: ofer
 * Date: 06/09/13
 * Time: 21:38
 */

var mongodb = require('mongodb');
var Db = mongodb.Db;
var Connection = mongodb.Connection;
var Server = mongodb.Server;
var BSON = mongodb.BSONPure;
var ObjectID = mongodb.ObjectID;
var assert = require('assert');

EmotivProvider = require('./emotivprovider').EmotivProvider;
var emotivProvider = new EmotivProvider(GLOBAL.mongo_host, GLOBAL.mongo_port);

SpotifyProvider = function (host, port) {
//    this.db = new Db('node_mongo_Brainify', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
//    this.db.open(function () {
//    });
    var provider = this;
    var connectionString = process.env.CUSTOMCONNSTR_MONGOLAB_URI || "mongodb://127.0.0.1:27017";
    Db.connect(connectionString, function(err, db1) {
        if (err) {
            console.log(err);
        } else {
            provider.db = db1;
        }
    });
};


SpotifyProvider.prototype.getPlayedIntervalsCollection = function (callback) {
    if (!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('spotify_played_intervals', function (error, played_intervals_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, played_intervals_collection);
        }
    });
};

SpotifyProvider.prototype.getGlobalRatingCollection = function (callback) {
    if (!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('spotify_global_rating', function (error, global_rating_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, global_rating_collection);
        }
    });
};

SpotifyProvider.prototype.getPrivateRatingCollection = function (callback) {
    if (!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('spotify_private_rating', function (error, private_rating_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, private_rating_collection);
        }
    });
};

// In case of an error, calls the error handler
SpotifyProvider.prototype.getTopSongsForUser = function (collection, user_id, top_number, sort_by, error_handler, in_callback) {
    top_number = parseInt(top_number);
    var return_results = function (error, songs_array) {
        if (error) {
            error_handler(error);
            return;
        }

        for (var i = 0; i < songs_array.length; i++) {
            songs_array[i].rank = i;
        }

        in_callback(songs_array);
    };
    if (user_id != null) {
        collection.find({user_id: user_id}).sort(sort_by).limit(top_number).toArray(return_results);
    } else {
        collection.find().sort(sort_by).limit(top_number).toArray(return_results);
    }
}

SpotifyProvider.prototype.returnTopRated = function (recommendation_result, collection, user_id, top_number, callback) {
    var provider = this;
    // In case of an error, getTopSongsForUser calls the callback function with the error value.
    provider.getTopSongsForUser(collection, user_id, top_number, {meditation: -1}, callback, function (result) {
        recommendation_result.meditation = result;
        provider.getTopSongsForUser(collection, user_id, top_number, {engagement: -1}, callback, function (result) {
            recommendation_result.engagement = result;
            provider.getTopSongsForUser(collection, user_id, top_number, {happiness: 1}, callback, function (result) {
                recommendation_result.happiness = result;
                provider.getTopSongsForUser(collection, user_id, top_number, {excitement: -1}, callback, function (result) {
                    recommendation_result.excitement = result;
                    callback(null, recommendation_result);
                });
            });
        });
    });
};

// Get the records in user private rating table
SpotifyProvider.prototype.getRecommendationsForUser = function (user_id, top_number, callback) {
    var recommendation_result = {
        user_id: user_id,
        top_number: top_number
    };
    var provider = this;
    this.getPrivateRatingCollection(function (error, private_rating_collection) {
        if (error) {
            callback(error);
            return;
        } else {
            provider.returnTopRated(recommendation_result, private_rating_collection, user_id, top_number, callback);
        }
    });
};

// Get the records in global rating table
SpotifyProvider.prototype.getGlobalRecommendations = function (top_number, callback) {
    var recommendation_result = {
        top_number: top_number
    };
    var provider = this;
    this.getGlobalRatingCollection(function (error, global_rating_collection) {
        if (error) {
            callback(error);
            return;
        } else {
            provider.returnTopRated(recommendation_result, global_rating_collection, null, top_number, callback);
        }
    });
};


SpotifyProvider.prototype.saveSongStatus = function (user_id, song_status_data, callback) {

    //var song_status = JSON.parse(song_status_data);
    var song_status = song_status_data;
    var song_id = song_status.current_track_id;
    var is_playing = song_status.is_playing;

    var provider = this;

    // Updates its status in the song intervals table and summarizes all of the samples into the song rating tables.
    provider.updateSongStatus(user_id, song_id, is_playing);

    provider.getSongRating(user_id, song_id, function (error, song_rating) {
        if (error) {
            callback(error);
            return;
        } else {
            callback(null, song_rating);
            return;
        }
    });
};


SpotifyProvider.prototype.updateSongStatus = function (user_id, song_id, is_playing) {

    is_playing = ((is_playing === 'true') || (is_playing === true));

    var curr_time = new Date().getTime();
    var provider = this;


    provider.getPlayedIntervalsCollection(function (error, played_intervals_collection) {
        if (error) {
            // Log this!
            console.log("Error: Error getting played intervals collection!");
            console.log(error);
            return;
        }
        else {
            if (is_playing) { // We have a new song to record.
                var new_record = {
                    user_id: user_id,
                    song_id: song_id,
                    start_time: curr_time,
                    end_time: 0
                };
                played_intervals_collection.insert(new_record, {w: 0});
            } else { // We need to close the previous record and to calculate the song statistics.
                played_intervals_collection.find({user_id: user_id, song_id: song_id}).sort({start_time: -1}).limit(1).toArray(function (error, song_intervals) {
                    if (error) {
                        // Log this!
                        console.log("Error: Error trying to find the last song interval!");
                        console.log(error);
                        return;
                    }
                    if (song_intervals.length == 0) {
                        // Log this!
                        console.log("Error: failed to find the last song interval!");
                        return;
                    }

                    var curr_song_interval = song_intervals[0];
                    if (curr_song_interval.end_time != 0) {
                        // Log this!
                        console.log("Error: last song interval end time != 0!");
                        return;
                    }

                    played_intervals_collection.update(
                        { _id: curr_song_interval._id },
                        { $set: { end_time: curr_time } },
                        { multi: false, w: 0 }
                    );

                    provider.updateSongRatingOnEnd(user_id, song_id, curr_song_interval.start_time, curr_time);
                    return;
                });
            }
        }
    });
};

SpotifyProvider.prototype.calcAveragedRating = function (old_rating, old_samples_num, new_rating, new_samples_num) {
    return (old_rating * old_samples_num + new_rating * new_samples_num) / (old_samples_num + new_samples_num);
};

SpotifyProvider.prototype.updateSongRatingOnEnd_calcAndUpdate = function (user_id, song_id, samples) {
    var samples_number = samples.length;

    if (samples_number == 0) {
        return;
    }

    // calc average.
    var meditation = 0;
    var engagement = 0;
    var happiness = 0;
    var excitement = 0;
    for (var i = 0; i < samples_number; i++) {
        meditation += samples[i].meditation;
        engagement += samples[i].engagement;
        happiness += samples[i].happiness;
        excitement += samples[i].excitement;
    }
    meditation /= samples_number;
    engagement /= samples_number;
    happiness /= samples_number;
    excitement /= samples_number;

    var provider = this;

    // Update/create the record in global rating table
    // Asynchronious call (we don't wait for the response).
    this.getGlobalRatingCollection(function (error, global_rating_collection) {
        if (error) {
            // Log this!
            console.log("Error: Error getting global rating collection!");
            console.log(error);
            return;
        } else {
            global_rating_collection.find({song_id: song_id}).toArray(function (error, songs_array) {
                if (error) {
                    // Log this!
                    console.log("Error: Error trying to get the song rating!");
                    console.log(error);
                    return;
                }

                if (songs_array.length > 1) {
                    // Log this!
                    console.error("Error: There is more than 1 record for the song!");
                    return;
                }

                if (songs_array.length == 0) { // No record for the song, we need to create it.
                    var new_record = {
                        song_id: song_id,
                        samples_num: samples_number,
                        meditation: meditation,
                        engagement: engagement,
                        happiness: happiness,
                        excitement: excitement
                    };
                    global_rating_collection.insert(new_record, {w: 0});
                } else { // We need to update the current record
                    var old_record = songs_array[0];

                    global_rating_collection.update(
                        { _id: old_record._id },
                        { $set: {
                            samples_num: old_record.samples_num + samples_number,
                            meditation: provider.calcAveragedRating(old_record.meditation, old_record.samples_num, meditation, samples_number),
                            engagement: provider.calcAveragedRating(old_record.engagement, old_record.samples_num, engagement, samples_number),
                            happiness: provider.calcAveragedRating(old_record.happiness, old_record.samples_num, happiness, samples_number),
                            excitement: provider.calcAveragedRating(old_record.excitement, old_record.samples_num, excitement, samples_number)
                        } },
                        { multi: false, w: 0 }
                    );
                }
            });
        }
    });

    // Update/create the record in user private rating table
    // Asynchronious call (we don't wait for the response).
    this.getPrivateRatingCollection(function (error, private_rating_collection) {
        if (error) {
            // Log this!
            console.log("Error: Error getting private rating collection!");
            console.log(error);
            return;
        } else {
            private_rating_collection.find({user_id: user_id, song_id: song_id}).toArray(function (error, songs_array) {
                if (error) {
                    // Log this!
                    console.log("Error: Error trying to get the song rating!");
                    console.log(error);
                    return;
                }

                if (songs_array.length > 1) {
                    // Log this!
                    console.error("Error: There is more than 1 record for the song!");
                    return;
                }

                if (songs_array.length == 0) { // No record for the song, we need to create it.
                    var new_record = {
                        user_id: user_id,
                        song_id: song_id,
                        samples_num: samples_number,
                        meditation: meditation,
                        engagement: engagement,
                        happiness: happiness,
                        excitement: excitement
                    };
                    private_rating_collection.insert(new_record, {w: 0});
                } else { // We need to update the current record
                    var old_record = songs_array[0];

                    private_rating_collection.update(
                        { _id: old_record._id },
                        { $set: {
                            samples_num: old_record.samples_num + samples_number,
                            meditation: provider.calcAveragedRating(old_record.meditation, old_record.samples_num, meditation, samples_number),
                            engagement: provider.calcAveragedRating(old_record.engagement, old_record.samples_num, engagement, samples_number),
                            happiness: provider.calcAveragedRating(old_record.happiness, old_record.samples_num, happiness, samples_number),
                            excitement: provider.calcAveragedRating(old_record.excitement, old_record.samples_num, excitement, samples_number)
                        } },
                        { multi: false, w: 0 }
                    );
                }
            });
        }
    });
};

SpotifyProvider.prototype.updateSongRatingOnEnd = function (user_id, song_id, start_time, end_time) {
    var spotProvider = this;

    emotivProvider.getEmotivCollection(function (error, samples_collection) {
        if (error) {
            // Log this!
            console.log("Error: Error getting emotive collection!");
            console.log(error);
            return;
        }
        else {
            samples_collection.find({user_id: user_id, server_time: { $gt: start_time, $lt: end_time }}
            ).toArray(function (error, relevant_samples) {
                    if (error) {
                        // Log this!
                        console.log("Error: Error trying to get the relevant samples to the time interval!");
                        console.log(error);
                        return;
                    }
                    console.info("Info: found " + relevant_samples.length + " relevant samples for the song!");
                    spotProvider.updateSongRatingOnEnd_calcAndUpdate(user_id, song_id, relevant_samples);
                });
            return;
        }
    });

};

// Retrieves the song rating, for the specific user and the song general rating.
SpotifyProvider.prototype.getSongRating = function (user_id, song_id, callback) {
    var song_rating = {};

    var provider = this;
    // Get the record in global rating table
    provider.getGlobalRatingCollection(function (error, global_rating_collection) {
        if (error) {
            // Log this!
            console.log("Error: Error getting global rating collection!");
            console.log(error);
            callback(error);
        } else {
            global_rating_collection.find({song_id: song_id}).toArray(function (error, songs_array) {
                if (error) {
                    // Log this!
                    console.log("Error: Error trying to get the song rating!");
                    console.log(error);
                    callback(error);
                }

                if (songs_array.length > 1) {
                    // Log this!
                    console.error("Error: There is more than 1 record for the song!");
                    callback(new Error("Error: There is more than 1 record for the song!"));
                }

                if (songs_array.length == 0) { // No record for the song
                    song_rating.global = "no data";
                } else {
                    song_rating.global = songs_array[0];
                }

                // Get the record in user private rating table
                provider.getPrivateRatingCollection(function (error, private_rating_collection) {
                    if (error) {
                        // Log this!
                        console.log("Error: Error getting private rating collection!");
                        console.log(error);
                        callback(new Error("Error: Error getting private rating collection!"));
                    } else {
                        private_rating_collection.find({user_id: user_id, song_id: song_id}).toArray(function (error, songs_array) {
                            if (error) {
                                // Log this!
                                console.log("Error: Error trying to get the song rating!");
                                console.log(error);
                                callback(new Error("Error: Error trying to get the song rating!"));
                            }

                            if (songs_array.length > 1) {
                                // Log this!
                                console.error("Error: There is more than 1 record for the song!");
                                callback(new Error("Error: There is more than 1 record for the song!"));
                            }

                            if (songs_array.length == 0) { // No record for the song
                                song_rating.user = "no data";
                            } else {
                                song_rating.user = songs_array[0];
                            }

                            callback(null, song_rating);
                        });
                    }
                });

            });
        }
    });
};


exports.SpotifyProvider = SpotifyProvider;