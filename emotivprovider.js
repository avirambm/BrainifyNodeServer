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

};

EmotivProvider.prototype.getSamplesAndInstructionsForUser = function (user_id_param, callback) {

};

exports.EmotivProvider = EmotivProvider;