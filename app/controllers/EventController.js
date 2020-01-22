var appController = require("../../app/controllers/AppController.js");
var clientList = require('../../app/models/clientList.js');
var tNotify = require("../../app/drivers/notify");

var myApps=appController();

module.exports=function(){
console.log("SSE Events started");
    var shouldRetry = true;
    var retryTime = 10000; //10 seconds

    function retry(retryFunc) {

      if(shouldRetry) {

        // Retry in 10 seconds to give dropped clients a chance to reconnect
        console.log('No clients found. Retrying in 10 seconds...');
        shouldRetry = false;
        setTimeout(retryFunc, retryTime);


      }
      else {
        console.log('No clients found. Bailing out!');
        shouldRetry = true; //reset
      }

    };

    return {

      publishUpdateForAllApps: function(userId) {
        
        function publishUpdate(userId) {
          var client = clientList.getClient(userId);

          if(client && client.responseList && client.responseList.length > 0) {
            var apps = [];

            myApps.getAppList(userId,
              function (outputList){
                var appList = outputList.results;

                for(var j=0;j<appList.length;j++){
                    apps.push({ 'appId' : appList[j].id, 'status' : appList[j].status });
                }

                for(var k=0;k<client.responseList.length;k++) {
                  client.responseList[k].response.sseSend(apps);
                }
            });

          }
          else {
            retry(function() {
              publishUpdate(userId);
            });
          }
        }

        publishUpdate(userId);
      },

      publishUpdateForApp: function(userId, appId){

        function publishUpdate(userId, appId) {
          console.log("PublishUpdate for User: "+userId);
          var client = clientList.getClient(userId);

          if(client && client.responseList && client.responseList.length > 0) {

            /*myApps.getAppByIDAuth(userId, appId,
              function (result){

                if(result && result.result[0]) {

                  var app = result.result[0];
                  var update = [{ 'appId' : app.appId, 'status' : app.status }];

                  for(var k=0;k<client.responseList.length;k++) {
                    client.responseList[k].response.sseSend(update);
                  }
                }
            });*/

            tNotify.getStatus(appId, function(err, data){
              console.log("Dynamo Results: "+JSON.stringify(data));
              if(!err){
                var update = [{ 'appId' : appId, 'status' : data }];
                for(var k=0;k<client.responseList.length;k++) {
                  client.responseList[k].response.sseSend(update);
                }
              }
            });

          }
          else {

            retry(function() {
              publishUpdate(userId, appId);
            });
          }
        }
        
        publishUpdate(userId, appId);
      }
    }
};
