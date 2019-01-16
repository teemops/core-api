
var AWS    = require('aws-sdk');   
var dynamodb = new AWS.DynamoDB();

function Dynamo(table){
  this.table=table; 
}

Dynamo.prototype.createTable = function(table) {
  dynamodb.describeTable({TableName: 'teemops.users'}, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
};



module.exports = Dynamo;