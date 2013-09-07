/**
 * This file handles the logic and DB actions related to the emotiv actions.
 * User: Ofer
 * Date: 06/09/13
 * Time: 21:35
 */


var mongodb = require('mongodb');
var Db = mongodb.Db;
var Connection = mongodb.Connection;
var Server = mongodb.Server;
var BSON = mongodb.BSONPure;
var ObjectID = mongodb.ObjectID;
var assert = require('assert');

var SONG_ACTION_DELAY = 1000; // 1 second
var VOLUME_ACTION_DELAY = 1000; // 1 second

var WINK_SAMPLES_TO_ACTION = 10;

var TURN_Y_THRESHOLD_UP = 1000;
var TURN_Y_THRESHOLD_DOWN = -TURN_Y_THRESHOLD_UP;
var TURN_X_THRESHOLD_RIGHT = 2000;
var TURN_X_THRESHOLD_LEFT = -TURN_X_THRESHOLD_RIGHT;
var GYRO_MAX_MOVE = 10000;
var CHANGE_VOLUME_SPECTRUM = GYRO_MAX_MOVE - Math.sqrt(TURN_Y_THRESHOLD_UP * TURN_Y_THRESHOLD_UP + TURN_X_THRESHOLD_RIGHT * TURN_X_THRESHOLD_RIGHT);
var CHANGE_VOLUME_NORMAL = 0.4;

var MAX_SAMPLES = 50;
var MILLISECONDS_OF_SAMPLES_BACK = 1000 * 3;

EmotivProvider = function (host, port) {
    this.db = new Db('node_mongo_Brainify', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
    this.db.open(function () {
    });
};

EmotivProvider.prototype.getEmotivCollection = function (callback) {
    if(!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('emotiv_samples', function (error, samples_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, samples_collection);
        }
    });
};

EmotivProvider.prototype.getUserCollection = function (callback) {
    if(!this.db.serverConfig.isConnected()) {
        callback("Db is not connected!");
        return;
    }

    this.db.collection('users', function (error, user_collection) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, user_collection);
        }
    });
};

// save new samples to db
EmotivProvider.prototype.save = function (data, callback) {

    if (!data || typeof(data) != "object") {
        callback("Error: Data input is invalid!");
        return;
    }

    // data = JSON.parse(data);

    if (!data.user_id || !data.samples) {
        callback("Error: Some fields in input are missing!");
        return;
    }

    var user_id = data.user_id;
    var samples = data.samples;

    if (typeof(samples.length) == "undefined" || samples.length < 1) {
        callback("Error: samples must be an array!");
        return;
    }

    var curr_time = new Date().getTime();
    // The offset between the current time and the last sample in computer time.
    var time_offset = curr_time - Math.max.apply(Math,samples.map(function(o){return o.local_time;}));


    // Add to all samples user id and adjusted server time
    samples.forEach(function(item) {
        item.user_id = user_id;
        item.server_time = item.local_time + time_offset;
    });

    this.getEmotivCollection(function (error, samples_collection) {
        if (error) {
            callback(error);
            return;
        }
        else {
            samples_collection.insert(samples);
            callback(null);
            return;
        }
    });
};

EmotivProvider.prototype.getOrCreateUser = function (user_id_param, errorHandler, callback) {
    this.getUserCollection(function (error, users_collection) {
        if (error) {
            errorHandler(error);
        }
        else {
            var user = undefined;
            users_collection.find({user_id: user_id_param}).toArray(function (err, documents) {
                if (error) {
                    errorHandler(error);
                    return;
                }
                if (documents.length == 0) {
                    // Insert new user to DB
                    users_collection.insert({user_id: user_id_param, last_sample_time:0, last_volume_action:0, last_song_action:0},
                        function(error, inserted_documents){
                            if (error) {
                                errorHandler(error);
                                return;
                            }
                            user = documents[0];
                            callback(users_collection, user);
                        });
                } else { // documents.length != 0
                    user = documents[0];
                    callback(users_collection, user);
                }
            });
        }
    });
}

EmotivProvider.prototype.getRelevantSamples = function (user, errorHandler, callback) {
    this.getEmotivCollection(function (error, samples_collection) {
        if (error) {
            errorHandler(error);
            return;
        }
        else {
            samples_collection.find({user_id: user.user_id, server_time:{ $gt: user.last_sample_time } }
            ).sort({server_time:-1}).limit(MAX_SAMPLES).toArray(function (error, samples_to_send) {
                    if (error) {
                        errorHandler(error);
                        return;
                    }
                    var from_time = new Date().getTime() - MILLISECONDS_OF_SAMPLES_BACK;
                    samples_collection.find({user_id: user.user_id, server_time:{ $gt: from_time } }
                    ).sort({server_time:-1}).toArray(function (error, samples_for_instructions) {
                            if (error) {
                                errorHandler(error);
                                return;
                            }
                            callback(samples_collection, samples_to_send, samples_for_instructions);
                        });
                });
        }
    });

}

EmotivProvider.prototype.generateInstructions = function (user, samples_for_instructions, samples_to_send) {
    var connection_strength = 0;
    var skip_track = 0;
    var change_volume = 0;
    var should_take_action = false;
    var curr_time = new Date().getTime();
    var x_delta = 0;
    var y_delta = 0;
    var x_max = 0;
    var x_min = 0;
    var y_max = 0;
    var y_min = 0;
    var winks_left = 0;
    var winks_right = 0;

    // connection_strength
    if (samples_to_send.length != 0) {
        for (var i = 0; i < samples_to_send.length; i++) {
            connection_strength += samples_to_send[i].connection_strength;
        }
        connection_strength /= samples_to_send.length;
    }

    for (var j = 0; j < samples_for_instructions.length; j++) {
        var sample = samples_for_instructions[j];

        // skip_track - determining whether reached WINKS_SAMPLES_TO_ACTION
        if (skip_track == 0 && (sample.server_time - user.last_song_action > SONG_ACTION_DELAY)) {
            winks_left = sample.wink_left ? (winks_left + 1) : (winks_left);
            winks_right = sample.wink_right ? (winks_right + 1) : (winks_right);
            if (winks_left == WINK_SAMPLES_TO_ACTION || winks_right == WINK_SAMPLES_TO_ACTION) {
                if (winks_left == WINK_SAMPLES_TO_ACTION) {
                    skip_track = -1;
                } else {
                    skip_track = 1;
                }
                user.last_song_action = sample.server_time;
                console.log("Set skip_track=" + skip_track + " time=" + user.last_song_action);
            }
        }

        // change_volume - determining x_max, x_min, y_max, y_min
        if (sample.server_time - user.last_volume_action > VOLUME_ACTION_DELAY) {
            x_delta += sample.turn_x;
            y_delta += sample.turn_y;
            if (x_delta > x_max) {
                x_max = x_delta;
            } else if (x_delta < x_min) {
                x_min = x_delta
            }
            if (y_delta > y_max) {
                y_max = y_delta;
            } else if (y_delta < y_min) {
                y_min = y_delta;
            }
        }
    }

    // change_volume - normalizing the volume change
    var delta_x = 0;
    var delta_y = 0;
    if (x_max > TURN_X_THRESHOLD_RIGHT && y_max > TURN_Y_THRESHOLD_UP) {
        delta_x = x_max - TURN_X_THRESHOLD_RIGHT;
        delta_y = y_max - TURN_Y_THRESHOLD_UP;
        change_volume = 1;
    } else if (x_min < TURN_X_THRESHOLD_LEFT && y_min < TURN_Y_THRESHOLD_DOWN) {
        delta_x = TURN_X_THRESHOLD_LEFT - x_min;
        delta_y = TURN_Y_THRESHOLD_DOWN - y_min;
        change_volume = -1;
    }
    change_volume *= (Math.sqrt(delta_x * delta_x + delta_y * delta_y) / CHANGE_VOLUME_SPECTRUM)/*0..1*/ * CHANGE_VOLUME_NORMAL/*0..0.4*/;

    // should_take_action
    if (skip_track != 0 || change_volume != 0) {
        should_take_action = true;
        // user.last_song_action is set before
        if(change_volume != 0) {
            user.last_volume_action = curr_time;
            console.log("Set change_volume=" + change_volume + " time=" + user.last_volume_action);
        }
    }

    var instructions = {};
    instructions.connection_strength = connection_strength;
    instructions.should_take_action = should_take_action;
    instructions.skip_track = skip_track;
    instructions.change_volume = change_volume;
    return instructions;
};

// Returns to the user the samples that were received since his last query, and the summarized instructions.
EmotivProvider.prototype.getSamplesAndInstructionsForUser = function (user_id_param, callback) {
    if (!user_id_param) {
        callback("Error: No user id supplied!");
        return;
    }

    var provider = this;

    provider.getOrCreateUser(user_id_param, callback /*errorHandler*/, function getSamplesAndInstructionsForUser_1(users_collection, user) {
        provider.getRelevantSamples(user, callback /*errorHandler*/, function getSamplesAndInstructionsForUser_2(samples_collection, samples_to_send, samples_for_instructions){
            var samples_and_instructions = provider.generateInstructions(user, samples_for_instructions /*more samples*/, samples_to_send);

            if (samples_and_instructions.connection_strength >= 0.5) {
                samples_and_instructions.samples = samples_to_send;
            }

            if(samples_to_send.length != 0) {
                // Find the sample time of the latest sample
                user.last_sample_time = Math.max.apply(Math,samples_to_send.map(function(o){return o.server_time;}));
                console.log("Info: updating user last sample time");
            }

            // Update user in users db to the time of last sample and the actions required.
            users_collection.update(
                { _id: user._id },
                user,
                { multi: false }
            );

            callback(null, samples_and_instructions);
            return;
        });
    });
};

exports.EmotivProvider = EmotivProvider;