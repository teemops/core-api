var subscribedClients = [];

function ClientList() {
}

ClientList.prototype.addClient = function(userId, token, response){
  var client = this.getClient(userId);

  if(client) {
    client.responseList.push({ 'token': token, 'response': response });
  }
  else {
    subscribedClients.push({ 'userId' : userId, 'responseList' : [{ 'token': token, 'response': response }]});
  }
};

ClientList.prototype.getClients = function() {
  return subscribedClients;
};

ClientList.prototype.removeClient = function(userId, token){
  var clientIndex = -1;
  var responseIndex = -1;

  // Find stored responses for userId
  for (var j=0;j<subscribedClients.length;j++) {
    if(subscribedClients[j].userId === userId){
      clientIndex = j;
      break;
    }
  }

  // Find specific response associated with user token
  if(clientIndex > -1){
    var client = subscribedClients[clientIndex];

    for(var k=0;k<client.responseList.length;k++){
      if (client.responseList[k].token === token) {
          responseIndex = k;
          break;
      }
    }
    client.responseList.splice(responseIndex,1);

    // If no responses remain for the userid, then remove that client completely
    if(client.responseList.length === 0){
      subscribedClients.splice(clientIndex, 1);
    }
  }
};

ClientList.prototype.getClient = function(userId){
  var client = subscribedClients.find(function(x) {
    return x.userId = userId;
  });

  return client;
}

module.exports = new ClientList();
