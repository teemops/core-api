var nodemailer = require('nodemailer');
var config = require('config-json');  
switch(process.env.MODE){
    case "prod":
        config.load('./app/config/config.prod.json');
        break;
    case "test":
        config.load('./app/config/config.test.json');
        break;
    case "dev":
        config.load('./app/config/config.json');
        break;
    default:
        config.load('./app/config/config.json');
}

var auth_host = config.get("notifications", "smtp_host");
var auth_user = config.get("notifications", "smtp_user");
var auth_pass = config.get("notifications", "smtp_pass");

module.exports=function(){
    return {
        init:  function init () {
            
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Send email
         */
        sendEmail: function sendEmail(to, subject, message, callback){
            // create reusable transporter object using the default SMTP transport 
            var transporter = nodemailer.createTransport('smtps://'+auth_user+':'+auth_pass+'@'+auth_host);
            
            // setup e-mail data with unicode symbols 
            var mailOptions = {
                from: auth_user, // sender address 
                to: to, // list of receivers 
                subject: subject, // Subject line 
                text: message, // plaintext body 
                html: message // html body 
            };
            
            // send mail with defined transport object 
            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
                return true;
            });

        },
        
    }
};