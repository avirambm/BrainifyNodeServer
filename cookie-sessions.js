/**
 * Created with IntelliJ IDEA.
 * User: Ofer
 * Date: 06/06/13
 * Time: 04:27
 * To change this template use File | Settings | File Templates.
 */


module.exports = function(name) {
    return function(req, res, next) {
        req.session = req.signedCookies[name] || {};

        res.on('header', function(){
            res.cookie(name, req.session, {signed: true});
        });

        next();
    }
}