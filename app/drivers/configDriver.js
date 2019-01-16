var config = require('config-json');  

module.exports=function(){
    return {
        init:  function init () {
            
        },
        item:  function get (items) {
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

            console.log("config get items"+config.get(items));
            return config.get(items);
        }
    }
};