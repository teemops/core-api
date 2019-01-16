var UserModel = require('../models/index.js');
var jwt = require('jwt-simple');

module.exports = function(req, res, next) {
    // code goes here
    var token = req.headers['x-access-token'];
    if (token) {
        try {
            var decoded = jwt.decode(token, app.get('jwtTokenSecret'));
                console.log(token);
            // handle token here

        } catch (err) {
            return next();
        }
    } else {
        next();
    }
};