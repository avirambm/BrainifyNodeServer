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



// Get the records in user private rating table
SpotifyProvider.prototype.getRecommendationsForUser = function (user_id, top_number, callback) {

};

// Get the records in user private rating table
SpotifyProvider.prototype.getGlobalRecommendations = function (top_number, callback) {

};


SpotifyProvider.prototype.saveSongStatus = function (user_id, song_status_data, callback) {

};


exports.SpotifyProvider = SpotifyProvider;