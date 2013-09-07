
/*
 * GET users listing.
 */

UserProvider = require('../userprovider').UserProvider;
var userProvider= new UserProvider('localhost', 27017);

exports.create = function(req, res){
    userProvider.save({
        email_address: req.param('email_address'),
        password: req.param('password'),
        full_name: req.param('full_name')
    }, function( error, user) {
        if(error) {
            res.statusCode = 400;
            res.send(error);
        } else {
            req.session.user_id = user._id.toString();
            res.send(200);
        }
    });
};

exports.login = function(req, res){
    userProvider.loginUser({
        email_address: req.param('email_address'),
        password: req.param('password')
    }, function( error, is_valid, user) {
        if(error) {
            res.statusCode = 400;
            res.send(error);
        } else {
            if(is_valid) {
                req.session.user_id = user._id.toString();
                res.statusCode = 200;
                var newUser = {};
                newUser.email_address = user.email_address;
                newUser.full_name = user.full_name;
                newUser.created_at = user.created_at;
                newUser.remaining_coins = user.remaining_coins;
                newUser.last_connection = user.last_connection;
                res.send(newUser);
            } else {
                req.session.user_id = undefined;
                res.statusCode = 403;
                res.send("UserName or Password incorrect!");
            }
        }
    });
};

exports.isloggedin = function(req, res){
    // Will be returned only if the middleware will not return 403 before...
    res.send(200);
};

exports.signout = function(req, res){
    req.session.user_id = undefined;
    res.statusCode = 200;
    res.send("User logged out successfully!");
};

