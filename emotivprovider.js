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

var SONG_ACTION_DELAY = 2000; // 2 seconds
var VOLUME_ACTION_DELAY = 2000; // 2 seconds
var TURN_Y_THERESHOLD_UP = 2000;
var TURN_Y_THERESHOLD_DOWN = -2000;
var TURN_X_THERESHOLD_RIGHT = 2000;
var TURN_X_THERESHOLD_LEFT = -2000;
var VOLUME_NORMAL = 100;

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

EmotivProvider.prototype.checkSongAction = function(item) {
    if (item.turn_y > TURN_Y_THERESHOLD_UP) {
        if (item.turn_x > TURN_X_THERESHOLD_RIGHT) {
            return 1;
        } else if (item.turn_x < TURN_X_THERESHOLD_LEFT) {
            return -1;
        }
    }
    return 0;
}

EmotivProvider.prototype.checkVolumeAction = function(item) {
    if (item.turn_y > TURN_Y_THERESHOLD_UP) {
        if (item.turn_x > TURN_X_THERESHOLD_LEFT && item.turn_x < TURN_X_THERESHOLD_RIGHT) {
            return (item.turn_y - TURN_Y_THERESHOLD_UP) / VOLUME_NORMAL;
        }
    } else if (item.turn_y < TURN_Y_THERESHOLD_DOWN) {
        return (TURN_Y_THERESHOLD_DOWN - item.turn_y) / VOLUME_NORMAL;
    }
    return 0;
}

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

    for (var i = 0; i < samples_to_send.length; i++) {
        var item = samples_to_send[i];

        connection_strength += item.connection_strength;

        if (item.server_time - user.last_song_action > SONG_ACTION_DELAY && skip_track == 0) {
            skip_track = this.checkSongAction(item);
        }

        if (item.server_time - user.last_volume_action > VOLUME_ACTION_DELAY && change_volume == 0) {
            change_volume = this.checkVolumeAction(item);
        }
    }

    if (samples_to_send.length != 0) {
        connection_strength /= samples_to_send.length;
    }

    if (skip_track != 0 || change_volume != 0) {
        should_take_action = true;
        if(skip_track != 0) {
            user.last_song_action = curr_time;
        }
        if(change_volume != 0) {
            user.last_volume_action = curr_time;
        }
    }

    var instructions = {};
    instructions.connection_strength = connection_strength;
    instructions.should_take_action = should_take_action;
    instructions.skip_track = skip_track;
    instructions.change_volume = change_volume;
    return instructions;
}

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