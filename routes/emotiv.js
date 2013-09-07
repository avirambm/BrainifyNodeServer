/**
 * Handles Emotive data input and samples requests.
 * User: ofer
 * Date: 06/09/13
 * Time: 21:35
 */


EmotivProvider = require('../emotivprovider').EmotivProvider;
var emotivProvider= new EmotivProvider(GLOBAL.mongo_host, GLOBAL.mongo_port);


exports.saveSamples = function(req, res){
    emotivProvider.save(req.body, function(error) {
        if(error) {
            console.log(error.toString());
            res.statusCode = 400;
            res.send(error.toString());
        } else {
            res.send(200);
        }
    });
};

exports.getSamplesAndInstructions = function(req, res){
    emotivProvider.getSamplesAndInstructionsForUser(parseInt(req.params.uid), function( error, samples_and_instructions) {
        if(error) {
            console.log(error.toString());
            res.statusCode = 400;
            res.send(error.toString());
        } else {
            res.statusCode = 200;
            res.send(samples_and_instructions);
        }
    });
};
