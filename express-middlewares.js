/**
 * Created with IntelliJ IDEA.
 * User: Ofer
 * Date: 12/06/13
 * Updated: 6/9/13
 * To change this template use File | Settings | File Templates.
 */
//var SERVER_URL = 'http://crowdopinion2.aws.af.cm';
var SERVER_URL = 'http://192.168.1.10:8383';

EmotivProvider = require('./emotivprovider').EmotivProvider;
var emotivProvider= new EmotivProvider(GLOBAL.mongo_host, GLOBAL.mongo_port);

// ## CORS middleware
// see: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
exports.allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', SERVER_URL);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.send(200);
    }
    else {
        next();
    }
};

// ## IsLoggedIn middleware
// if the url is not signup or login, check that the user is loggedIn.
exports.isUserLoggedIn = function(req, res, next) {
    var url = req.url;

    // Continue if it is a signup or login request
    if (('POST' == req.method) &&
        (('/users' == url) || ('/users/login' == url) || ('/users/signout' == url))) {
        next();
    }
    else { // Not a signup/login request
        if(req.session.user_id === undefined) {
            res.statusCode = 403;
            res.send("User is not logged in - session.user_id === undefined!");
            return;
        }

        emotivProvider.isUserLoggedIn(req.session.user_id,
            function( error, is_logged_in) {
                if(error) {
                    res.statusCode = 400;
                    res.send(error);
                } else {
                    if(is_logged_in) {
                        next();
                    } else { // Not loggedIn!
                        req.session.user_id = undefined;
                        res.statusCode = 403;
                        res.send("User is not logged in!");
                    }
                }
            }
        );
    }
};

