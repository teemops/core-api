var nodemailer = require('nodemailer');

var config, auth_host, auth_user, auth_pass;

module.exports = function () {
    return {
        init: function init(appConfig) {
            config = appConfig;
            auth_host = config.get("notifications", "smtp_host");
            auth_user = config.get("notifications", "smtp_user");
            auth_pass = config.get("notifications", "smtp_pass");
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Send email
         */
        sendEmail: function sendEmail(to, subject, message, callback) {
            // create reusable transporter object using the default SMTP transport 
            var transporter = nodemailer.createTransport('smtps://' + auth_user + ':' + auth_pass + '@' + auth_host);

            // setup e-mail data with unicode symbols 
            var mailOptions = {
                from: auth_user, // sender address 
                to: to, // list of receivers 
                subject: subject, // Subject line 
                text: message, // plaintext body 
                html: message // html body 
            };

            // send mail with defined transport object 
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    callback(error, null)
                } else {
                    console.log('Message sent: ' + info.response);
                    callback(null, true)
                }

            });

        },

    }
};