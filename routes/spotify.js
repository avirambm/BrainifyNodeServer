/**
 * Handles Spotify data input and requests for songs recommendations.
 * User: ofer
 * Date: 06/09/13
 * Time: 21:35
 */
SpotifyProvider = require('../spotifyprovider').SpotifyProvider;
var spotifyProvider = new SpotifyProvider(GLOBAL.mongo_host, GLOBAL.mongo_port);

exports.getRecommendationsForUser = function(req, res){
    spotifyProvider.getRecommendationsForUser(parseInt(req.params.uid), req.params.top_number, function( error, recommendations_for_user) {
        if(error) {
            console.log(error.toString());
            res.statusCode = 400;
            res.send(error.toString());
        } else {
            res.statusCode = 200;
            res.send(recommendations_for_user);
        }
    });
};

exports.getRecommendationsGlobal = function(req, res){
    spotifyProvider.getGlobalRecommendations(parseInt(req.params.top_number), function( error, global_recommendations) {
        if(error) {
            console.log(error.toString());
            res.statusCode = 400;
            res.send(error.toString());
        } else {
            res.statusCode = 200;
            res.send(global_recommendations);
        }
    });
};

exports.saveSongStatus = function(req, res){
    spotifyProvider.saveSongStatus(parseInt(req.params.uid), req.body, function( error, song_statistics) {
        if(error) {
            console.log(error.toString());
            res.statusCode = 400;
            res.send(error.toString());
        } else {
            res.statusCode = 200;
            res.send(song_statistics);
        }
    });
};
