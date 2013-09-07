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
    this.db = new Db('node_mongo_Brainify', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
    this.db.open(function () {
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
function getTopSongsForUser(collection, user_id, top_number, sort_by, error_handler, in_callback) {
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
    // In case of an error, getTopSongsForUser calls the callback function with the error value.
    getTopSongsForUser(collection, user_id, top_number, {meditation: -1}, callback, function (result) {
        recommendation_result.meditation = result;
        getTopSongsForUser(collection, user_id, top_number, {engagement: -1}, callback, function (result) {
            recommendation_result.engagement = result;
            getTopSongsForUser(collection, user_id, top_number, {happiness: 1}, callback, function (result) {
                recommendation_result.happiness = result;
                getTopSongsForUser(collection, user_id, top_number, {excitement: -1}, callback, function (result) {
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

};


exports.SpotifyProvider = SpotifyProvider;